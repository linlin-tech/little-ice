//! AI 流式事件契约
//!
//! 事件名 + payload 字段名必须与前端架构 §5 **完全一致**。
//! Rust 端发 camelCase（`#[serde(rename_all = "camelCase")]`）。
//!
//! ## Tauri 2 事件 API
//!
//! Tauri 1.x 的 `app.emit_all(event, payload)` 在 Tauri 2 中**已弃用**为
//! `app.emit(event, payload)`（来自 `tauri::Emitter` trait），二者语义等价：
//! "向**所有**窗口广播"。文档 §7.3 明确说：
//!
//! > `emit_all` 在 Tauri 2.x 中可换成 `app.emit_to("main", name, payload)` 按窗口发送。
//! > MVP 用全应用广播即可。
//!
//! 所以本文件统一用 `app.emit()`（全应用广播）—— 与文档意图一致，与 Tauri 1.x
//! `emit_all` 行为一致。

use serde::Serialize;
use tauri::Emitter;

use crate::error::AppError;

// ===== 事件名 =====
pub const AI_STREAM_START: &str = "ai-stream-start";
pub const AI_STREAM_CHUNK: &str = "ai-stream-chunk";
pub const AI_STREAM_END: &str = "ai-stream-end";
pub const AI_STREAM_ERROR: &str = "ai-stream-error";

// ===== Payload =====

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiStreamStart {
    pub chat_id: String,
    pub assistant_message_id: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiStreamChunk {
    pub chat_id: String,
    pub assistant_message_id: String,
    pub delta: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiStreamEnd {
    pub chat_id: String,
    pub assistant_message_id: String,
    pub full_content: String,
    /// `true` = 用户主动停止（§4.3 / §7.3）
    pub stopped: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiStreamError {
    pub chat_id: String,
    pub assistant_message_id: String,
    pub error: AiErrorPayload,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiErrorPayload {
    /// "network" | "model" | "timeout" | "unknown" | "api_key" | "validation"
    #[serde(rename = "type")]
    pub kind: String,
    pub message: String,
}

// ===== 发射器（Tauri 2 等价 emit_all）=====

pub fn emit_start(app: &tauri::AppHandle, payload: &AiStreamStart) {
    let _ = app.emit(AI_STREAM_START, payload);
}

pub fn emit_chunk(app: &tauri::AppHandle, payload: &AiStreamChunk) {
    let _ = app.emit(AI_STREAM_CHUNK, payload);
}

pub fn emit_end(app: &tauri::AppHandle, payload: &AiStreamEnd) {
    let _ = app.emit(AI_STREAM_END, payload);
}

pub fn emit_error(app: &tauri::AppHandle, chat_id: &str, assistant_id: &str, err: AppError) {
    let payload = AiStreamError {
        chat_id: chat_id.to_string(),
        assistant_message_id: assistant_id.to_string(),
        error: AiErrorPayload {
            kind: classify_error(&err),
            message: err.to_string(),
        },
    };
    let _ = app.emit(AI_STREAM_ERROR, &payload);
}

/// 把 `AppError` 映射为前端约定的 `error.type`。
///
/// 对应文档 §8.2 表格：
///
/// | AppError             | error.type  |
/// |----------------------|-------------|
/// | `AppError::Network`  | `network`   |
/// | `AppError::Ai("api_key")` | `api_key` |
/// | `AppError::Ai("timeout")` | `timeout` |
/// | `AppError::Ai(_)`    | `model`     |
/// | `AppError::NotFound` | `unknown`   |
/// | `AppError::Validation` | `validation` |
/// | `AppError::Database` / `Internal` | `unknown` |
pub fn classify_error(err: &AppError) -> String {
    match err {
        AppError::Network(_) => "network".to_string(),
        AppError::Ai(msg) => {
            // 特定字面量由 ai::client 在收到 401 / 超时时显式构造
            if msg == "api_key" {
                "api_key".to_string()
            } else if msg == "timeout" {
                "timeout".to_string()
            } else {
                "model".to_string()
            }
        }
        AppError::NotFound(_) => "unknown".to_string(),
        AppError::Validation(_) => "validation".to_string(),
        AppError::Database(_) | AppError::Internal(_) => "unknown".to_string(),
    }
}
