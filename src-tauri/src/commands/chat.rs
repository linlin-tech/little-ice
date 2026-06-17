//! Chat 命令（§6.1）
//!
//! 签名严格匹配前端架构 §4.1；任何修改需先更新前端文档。

use specta::specta;
use tauri::State;

use crate::error::AppResult;
use crate::models::Chat;
use crate::state::AppState;

#[tauri::command]
#[specta]
pub async fn create_chat(state: State<'_, AppState>, title: String) -> AppResult<Chat> {
    crate::db::chat::create(&state.db, title).await
}

#[tauri::command]
#[specta]
pub async fn list_chats(state: State<'_, AppState>) -> AppResult<Vec<Chat>> {
    crate::db::chat::list_all(&state.db).await
}

#[tauri::command]
#[specta]
pub async fn get_chat(state: State<'_, AppState>, id: String) -> AppResult<Chat> {
    crate::db::chat::get(&state.db, &id).await
}

#[tauri::command]
#[specta]
pub async fn rename_chat(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> AppResult<Chat> {
    let chat = crate::db::chat::rename(&state.db, &id, title).await?;
    Ok(chat)
}

#[tauri::command]
#[specta]
pub async fn set_chat_role(
    state: State<'_, AppState>,
    id: String,
    role_id: String,
) -> AppResult<Chat> {
    let chat = crate::db::chat::set_role(&state.db, &id, role_id).await?;
    Ok(chat)
}

#[tauri::command]
#[specta]
pub async fn delete_chat(state: State<'_, AppState>, id: String) -> AppResult<()> {
    crate::db::chat::delete(&state.db, &id).await
}
