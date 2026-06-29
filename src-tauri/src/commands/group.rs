//! Group 命令（分组管理）
//!
//! 支持对对话(chat)、收藏(favorite)、模型角色(role)三种资源进行分组。

use specta::specta;
use tauri::State;

use crate::error::AppResult;
use crate::models::{Group, ResourceType};
use crate::state::AppState;

#[tauri::command]
#[specta]
pub async fn create_group(
    state: State<'_, AppState>,
    resource_type: ResourceType,
    name: String,
) -> AppResult<Group> {
    crate::db::group::create(&state.db, resource_type, name).await
}

#[tauri::command]
#[specta]
pub async fn list_groups(
    state: State<'_, AppState>,
    resource_type: ResourceType,
) -> AppResult<Vec<Group>> {
    crate::db::group::list(&state.db, resource_type).await
}

#[tauri::command]
#[specta]
pub async fn rename_group(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> AppResult<Group> {
    crate::db::group::rename(&state.db, &id, name).await
}

#[tauri::command]
#[specta]
pub async fn delete_group(state: State<'_, AppState>, id: String) -> AppResult<()> {
    crate::db::group::delete(&state.db, &id).await
}

#[tauri::command]
#[specta]
pub async fn move_item_to_group(
    state: State<'_, AppState>,
    resource_type: ResourceType,
    item_id: String,
    group_id: String,
) -> AppResult<()> {
    crate::db::group::move_item(&state.db, resource_type, &item_id, Some(group_id)).await
}

#[tauri::command]
#[specta]
pub async fn move_item_out_of_group(
    state: State<'_, AppState>,
    resource_type: ResourceType,
    item_id: String,
) -> AppResult<()> {
    crate::db::group::move_item(&state.db, resource_type, &item_id, None).await
}
