//! 应用统一错误类型
//!
//! 对外（Tauri 命令、AI 事件）使用 `AppError` / `AppResult`。
//! 内部可自由使用 `anyhow::Result`。

use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("AI error: {0}")]
    Ai(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Summary generation failed: {0}")]
    SummaryGenerationFailed(String),

    #[error("Summary API timeout")]
    SummaryTimeout,

    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),
}

pub type AppResult<T> = Result<T, AppError>;

// Tauri 要求命令的 Result 类型必须可序列化
// 把错误转为 String 传给前端
impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}
