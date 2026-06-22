//! AI 流式任务：SSE → 事件 emit → DB 持久化

use tauri::AppHandle;
use tokio_util::sync::CancellationToken;

use crate::ai::client::{AiClient, ChatMessage};
use crate::ai::events::{
    AiStreamChunk, AiStreamEnd, AiStreamStart, emit_chunk, emit_end, emit_start,
};
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::Message;

/// 333 原则上下文：
///
/// [system role prompt] + [最近 3 个摘要] + [最近 3 轮对话] + [当前用户问题]
///
/// "最近 3 轮对话"指当前 assistant 占位消息之前最近完成的 3 对 user + assistant；
/// 当前用户问题也包含在返回的 messages 末尾。
pub(crate) async fn build_context(
    db: &DbPool,
    chat_id: &str,
    assistant_message_id: &str,
) -> AppResult<Vec<ChatMessage>> {
    // 1. 读取当前 chat 绑定的 role
    let role = crate::db::role::get_by_chat_id(db, chat_id).await?;

    // 2. 读取最近 3 个摘要（按时间正序）
    let summaries = crate::db::summary::list_recent_by_chat(db, chat_id, 3).await?;

    // 3. 读取当前 assistant 占位消息之前的最近 7 条消息：
    //    3 轮完整对话（6 条）+ 当前 user 问题（1 条）
    const RECENT_ROUNDS: usize = 3;
    const RECENT_MESSAGE_LIMIT: usize = RECENT_ROUNDS * 2 + 1;
    let mut recent: Vec<Message> = sqlx::query_as::<_, Message>(
        "SELECT id, chat_id, role, content, created_at \
         FROM messages \
         WHERE chat_id = ? AND id < ? \
         ORDER BY id DESC \
         LIMIT ?",
    )
    .bind(chat_id)
    .bind(assistant_message_id)
    .bind(RECENT_MESSAGE_LIMIT as i64)
    .fetch_all(db)
    .await?;
    recent.reverse(); // 按时间正序

    // 4. 组装上下文
    let mut context: Vec<ChatMessage> = Vec::with_capacity(recent.len() + summaries.len() + 1);
    context.push(ChatMessage {
        role: "system".to_string(),
        content: role.responsibility,
    });

    for s in summaries {
        context.push(ChatMessage {
            role: "system".to_string(),
            content: format!(
                "以下是对话摘要，请作为上下文参考：\n{}\n关键词：{}",
                s.content,
                s.keywords.0.join("、")
            ),
        });
    }

    for m in recent {
        context.push(ChatMessage {
            role: m.role.as_protocol_str().to_string(),
            content: m.content.clone(),
        });
    }

    Ok(context)
}

pub async fn run_stream(
    app: &AppHandle,
    ai: &AiClient,
    db: &DbPool,
    chat_id: &str,
    assistant_message_id: &str,
    cancel: CancellationToken,
) -> AppResult<()> {
    // 1. 读取 API Key
    let api_key = crate::db::settings::get(db, "deepseek_api_key")
        .await?
        .ok_or_else(|| AppError::Ai("api_key not set".into()))?;
    if api_key.is_empty() {
        return Err(AppError::Ai("api_key empty".into()));
    }

    // 2. 构造 333 原则上下文
    let context = build_context(db, chat_id, assistant_message_id).await?;

    // 3. 发送 Start 事件
    emit_start(
        app,
        &AiStreamStart {
            chat_id: chat_id.to_string(),
            assistant_message_id: assistant_message_id.to_string(),
        },
    );

    // 4. 开启 SSE 流
    let mut rx = ai.stream_chat(&api_key, &context, cancel.clone()).await?;
    let mut full_content = String::new();
    let mut stopped = false;

    // 5. 接收 chunks
    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                stopped = true;
                break;
            }
            chunk = rx.recv() => {
                match chunk {
                    Some(delta) => {
                        full_content.push_str(&delta);
                        emit_chunk(
                            app,
                            &AiStreamChunk {
                                chat_id: chat_id.to_string(),
                                assistant_message_id: assistant_message_id.to_string(),
                                delta,
                            },
                        );
                    }
                    None => break, // 流结束
                }
            }
        }
    }

    // 6. 持久化完整内容
    crate::db::message::update_content(db, assistant_message_id, &full_content).await?;
    crate::db::chat::touch(db, chat_id).await?; // 更新 chat 排序时间

    // 7. 发送 End 事件
    emit_end(
        app,
        &AiStreamEnd {
            chat_id: chat_id.to_string(),
            assistant_message_id: assistant_message_id.to_string(),
            full_content,
            stopped,
        },
    );

    Ok(())
}
