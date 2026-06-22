//! 对话摘要模型（113 原则）
//!
//! 113 原则：
//! - 1 个最近摘要
//! - 1 轮最近对话
//! - 每 3 轮触发一次摘要生成

use serde::{Deserialize, Serialize};
use sqlx::types::Json;

use super::UnixMs;

/// 核心摘要实体，对应数据库表 `chat_summaries`
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ChatSummary {
    pub id: String,
    pub chat_id: String,
    pub content: String,
    pub keywords: Json<Vec<String>>,
    pub last_message_id: String,
    pub created_at: UnixMs,
}

/// 上下文结构，用于构建发给 AI 的 Prompt
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SummaryContext {
    pub summary: Option<String>,
    pub keywords: Option<Vec<String>>,
    pub last_message_id: Option<String>,
}
