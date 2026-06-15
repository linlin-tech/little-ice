//! AI 流式任务：SSE → 事件 emit → DB 持久化

use tauri::AppHandle;
use tokio_util::sync::CancellationToken;

use crate::ai::client::{AiClient, ChatMessage};
use crate::ai::events::{
    emit_chunk, emit_end, emit_start, AiStreamChunk, AiStreamEnd, AiStreamStart,
};
use crate::db::DbPool;
use crate::error::{AppError, AppResult};

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

    // 2. 读取该 chat 的历史 messages（构建上下文）
    let history = crate::db::message::list_by_chat(db, chat_id).await?;
    let context: Vec<ChatMessage> = history
        .iter()
        .map(|m| ChatMessage {
            role: m.role.as_protocol_str().to_string(),
            content: m.content.clone(),
        })
        .collect();

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
