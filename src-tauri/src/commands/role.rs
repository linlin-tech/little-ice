//! Role 命令（§6.x）
//!
//! 签名严格匹配前端架构 §4.x；任何修改需先更新前端文档。

use specta::specta;
use tauri::State;

use crate::error::AppResult;
use crate::models::Role;
use crate::state::AppState;

#[tauri::command]
#[specta]
pub async fn create_role(
    state: State<'_, AppState>,
    name: String,
    responsibility: String,
) -> AppResult<Role> {
    crate::db::role::create(&state.db, name, responsibility).await
}

#[tauri::command]
#[specta]
pub async fn list_roles(state: State<'_, AppState>) -> AppResult<Vec<Role>> {
    crate::db::role::list_all(&state.db).await
}

#[tauri::command]
#[specta]
pub async fn get_role(state: State<'_, AppState>, id: String) -> AppResult<Role> {
    crate::db::role::get(&state.db, &id).await
}

#[tauri::command]
#[specta]
pub async fn update_role(
    state: State<'_, AppState>,
    id: String,
    name: Option<String>,
    responsibility: Option<String>,
) -> AppResult<Role> {
    crate::db::role::update(&state.db, &id, name, responsibility).await
}

#[tauri::command]
#[specta]
pub async fn delete_role(state: State<'_, AppState>, id: String) -> AppResult<()> {
    crate::db::role::delete(&state.db, &id).await
}

#[tauri::command]
#[specta]
pub async fn get_role_by_chat_id(state: State<'_, AppState>, chat_id: String) -> AppResult<Role> {
    crate::db::role::get_by_chat_id(&state.db, &chat_id).await
}
