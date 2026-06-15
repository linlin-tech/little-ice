//! Settings 命令（§6.5）
//!
//! 签名严格匹配前端架构 §4.5；任何修改需先更新前端文档。

use specta::specta;
use tauri::State;

use crate::error::AppResult;
use crate::models::Settings;
use crate::state::AppState;

#[tauri::command]
#[specta]
pub async fn get_settings(state: State<'_, AppState>) -> AppResult<Settings> {
    let api_key = crate::db::settings::get(&state.db, "deepseek_api_key")
        .await?
        .unwrap_or_default();
    Ok(Settings {
        has_api_key: !api_key.is_empty(),
        deepseek_api_key: api_key, // 返回完整 key 给前端显示
    })
}

#[tauri::command]
#[specta]
pub async fn set_api_key(state: State<'_, AppState>, key: String) -> AppResult<Settings> {
    crate::db::settings::set(&state.db, "deepseek_api_key", &key).await?;
    get_settings(state).await
}
