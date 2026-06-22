    //! AI 流式任务：SSE → 事件 emit → DB 持久化

use tauri::AppHandle;
use tokio_util::sync::CancellationToken;

use crate::ai::client::{AiClient, ChatMessage};
use crate::ai::events::{
    emit_chunk, emit_end, emit_start, AiStreamChunk, AiStreamEnd, AiStreamStart,
};
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::Message;

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

    // 2. 读取当前 chat 绑定的 role
    let role = crate::db::role::get_by_chat_id(db, chat_id).await?;

    // 3. 读取该 chat 的历史 messages（构建上下文）
    let history = crate::db::message::list_by_chat(db, chat_id).await?;

    // 4. 构造上下文：system prompt + 最近 3 条历史消息（跳过当前刚创建的 assistant 占位消息；按时序）
    const HISTORY_LIMIT: usize = 3;
    let recent: Vec<&Message> = history
        .iter()
        .filter(|m| m.id != assistant_message_id)
        .rev()
        .take(HISTORY_LIMIT)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    let mut context: Vec<ChatMessage> = Vec::with_capacity(recent.len() + 1);
    context.push(ChatMessage {
        role: "system".to_string(),
        content: role.responsibility,
    });
    for m in recent {
        context.push(ChatMessage {
            role: m.role.as_protocol_str().to_string(),
            content: m.content.clone(),
        });
    }

    // 5. 发送 Start 事件
    emit_start(
        app,
        &AiStreamStart {
            chat_id: chat_id.to_string(),
            assistant_message_id: assistant_message_id.to_string(),
        },
    );

    // 6. 开启 SSE 流
    let mut rx = ai.stream_chat(&api_key, &context, cancel.clone()).await?;
    let mut full_content = String::new();
    let mut stopped = false;

    // 7. 接收 chunks
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

    // 8. 持久化完整内容
    crate::db::message::update_content(db, assistant_message_id, &full_content).await?;
    crate::db::chat::touch(db, chat_id).await?; // 更新 chat 排序时间

    // 9. 发送 End 事件
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
