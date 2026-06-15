//! AI 控制命令（§4.3 / §6.3）
//!
//! - `stop_generation`：中断对应 chat 的流；调用方负责保证流会发出 `ai-stream-end { stopped: true }`

use specta::specta;
use tauri::State;

use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
#[specta]
pub async fn stop_generation(state: State<'_, AppState>, chat_id: String) -> AppResult<()> {
    if let Some(token) = state.active_streams.lock().await.remove(&chat_id) {
        token.cancel();
        tracing::info!(chat_id = %chat_id, "stop_generation called");
    }
    Ok(())
}
