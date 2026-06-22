//! Message 命令（§4.2 / §6.2）
//!
//! - `list_messages`：纯查询，本任务注册
//! - `send_message`：写 user/assistant 占位消息 + 异步触发 AI 流（§4.2 + §6.2），本任务注册
//! - `delete_message`：删除一对配对消息（user + assistant），同时清理关联 favorites
//!
//! ## `delete_message` 语义
//!
//! 一次删除"一个回合"（user 提问 + assistant 回复）。前端点击 AI 回复下方的
//! 删除按钮触发：
//! 1. 后端按 `assistant_id` 找配对的 user_id（同一 chat、id 更小、最近的 user）
//! 2. 在事务里：解绑 favorites → 删两条 messages → COMMIT
//! 3. Chat 头部 ⭐ 徽章由 `count_by_chat` 实时统计，会自然下降，无需额外通知
//!
//! 返回 `Ok(())` 表示成功；不存在时返回 `AppError::NotFound`。

use serde::Serialize;
use specta::specta;
use specta::Type;
use tauri::Manager;
use tauri::State;
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

/// 删除一条 AI 回复消息（连同配对的 user 提问一起删除）。
///
/// ## 入参
/// - `chat_id`：消息所属 chat
/// - `assistant_id`：被点击的 AI 回复消息 id（前端从 `MessageItem.message.id` 取）
///
/// ## 行为
/// 1. 通过 `find_preceding_user` 找到同一 chat 内、id 更小的最近 user 消息
///    （理论上一定存在 — AI 回复必然由 user 提问触发；极端情况找不到则仅删 assistant）
/// 2. 在事务中解绑 favorites 的 `source_message_id` 指针，然后删两条 messages
///
/// ## 边界
/// - Chat 仍保留（即便删完最后一条消息）；前端 Chat 列表不受影响
/// - `count_by_chat` 自然下降，Chat 头部徽章无需额外事件
#[tauri::command]
#[specta]
pub async fn delete_message(
    state: State<'_, AppState>,
    chat_id: String,
    assistant_id: String,
) -> AppResult<()> {
    // 1. 找配对的 user message
    let user_msg =
        crate::db::message::find_preceding_user(&state.db, &chat_id, &assistant_id).await?;

    // 2. 删除（事务：解绑 favorites + 删两条 messages）
    if let Some(u) = user_msg {
        crate::db::message::delete_pair(&state.db, &chat_id, &u.id, &assistant_id).await?;
    } else {
        // 极端退化路径：找不到配对 user，仅删 assistant
        crate::db::message::delete_orphan_assistant(&state.db, &chat_id, &assistant_id).await?;
    }
    Ok(())
}