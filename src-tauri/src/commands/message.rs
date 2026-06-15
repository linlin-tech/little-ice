//! Message 命令（§4.2 / §6.2）
//!
//! - `list_messages`：纯查询，本任务注册
//! - `send_message`：写 user/assistant 占位消息 + 异步触发 AI 流（§4.2 + §6.2），本任务注册

use serde::Serialize;
use specta::specta;
use specta::Type;
use tauri::{Manager, State};
use tokio_util::sync::CancellationToken;

use crate::ai::events::emit_error;
use crate::error::AppResult;
use crate::models::{Message, MessageRole};
use crate::state::AppState;

#[tauri::command]
#[specta]
pub async fn list_messages(
    state: State<'_, AppState>,
    chat_id: String,
) -> AppResult<Vec<Message>> {
    crate::db::message::list_by_chat(&state.db, &chat_id).await
}

#[derive(Serialize, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageResult {
    pub user_message: Message,
}

/// 发送消息：
/// 1. 写 user message 到 DB
/// 2. 在 DB 预创建一条空的 assistant message（拿到 assistantMessageId）
/// 3. 异步触发 AI 流式生成
/// 4. 返回 `{ userMessage }`
#[tauri::command]
#[specta]
pub async fn send_message(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    chat_id: String,
    content: String,
) -> AppResult<SendMessageResult> {
    // 1. 持久化用户消息
    let user_msg =
        crate::db::message::create(&state.db, &chat_id, MessageRole::User, content).await?;

    // 2. 预创建 assistant 消息（content 留空，由流式任务回填）
    let assistant_msg = crate::db::message::create(
        &state.db,
        &chat_id,
        MessageRole::Assistant,
        String::new(),
    )
    .await?;

    // 3. 启动后台流任务
    let cancel_token = CancellationToken::new();
    state
        .active_streams
        .lock()
        .await
        .insert(chat_id.clone(), cancel_token.clone());

    let ai = state.ai.clone();
    let db = state.db.clone();
    let app_handle = app.clone();
    let chat_id_clone = chat_id.clone();
    let assistant_id = assistant_msg.id.clone();

    tokio::spawn(async move {
        if let Err(e) = crate::ai::stream::run_stream(
            &app_handle,
            &ai,
            &db,
            &chat_id_clone,
            &assistant_id,
            cancel_token,
        )
        .await
        {
            // 流失败时把错误 emit 给前端（按 §7.1）
            emit_error(&app_handle, &chat_id_clone, &assistant_id, e);
        }
        // 任务结束后清理取消令牌
        let state_ref = app_handle.state::<AppState>();
        let mut map = state_ref.active_streams.lock().await;
        map.remove(&chat_id_clone);
    });

    Ok(SendMessageResult {
        user_message: user_msg,
    })
}
