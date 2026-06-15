//! Favorite 命令（§6.4）
//!
//! 签名严格匹配前端架构 §4.4；任何修改需先更新前端文档。

use specta::specta;
use tauri::State;

use crate::db::favorite::FavoritePatch;
use crate::error::AppResult;
use crate::models::Favorite;
use crate::state::AppState;

#[tauri::command]
#[specta]
pub async fn create_favorite(
    state: State<'_, AppState>,
    title: String,
    content: String,
    source_chat_id: Option<String>,
    source_message_id: Option<String>,
) -> AppResult<Favorite> {
    crate::db::favorite::create(&state.db, title, content, source_chat_id, source_message_id).await
}

#[tauri::command]
#[specta]
pub async fn list_favorites(state: State<'_, AppState>) -> AppResult<Vec<Favorite>> {
    crate::db::favorite::list_all(&state.db).await
}

#[tauri::command]
#[specta]
pub async fn get_favorite(state: State<'_, AppState>, id: String) -> AppResult<Favorite> {
    crate::db::favorite::get(&state.db, &id).await
}

#[tauri::command]
#[specta]
pub async fn update_favorite(
    state: State<'_, AppState>,
    id: String,
    patch: FavoritePatch,
) -> AppResult<Favorite> {
    crate::db::favorite::update(&state.db, &id, patch).await
}

#[tauri::command]
#[specta]
pub async fn get_favorite_by_message_id(
    state: State<'_, AppState>,
    source_message_id: String,
) -> AppResult<Option<Favorite>> {
    crate::db::favorite::find_by_message_id(&state.db, &source_message_id).await
}

#[tauri::command]
#[specta]
pub async fn delete_favorite(state: State<'_, AppState>, id: String) -> AppResult<()> {
    crate::db::favorite::delete(&state.db, &id).await
}

#[tauri::command]
#[specta]
pub async fn count_favorites_by_chat(
    state: State<'_, AppState>,
    chat_id: String,
) -> AppResult<i64> {
    crate::db::favorite::count_by_chat(&state.db, &chat_id).await
}
