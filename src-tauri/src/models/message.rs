use serde::{Deserialize, Serialize};
use specta::Type;

use super::UnixMs;

/// Message（前端 Message，对应 §3 数据模型）
#[derive(Debug, Clone, Serialize, Deserialize, Type, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: String,
    pub chat_id: String,
    pub role: MessageRole,
    pub content: String,
    pub created_at: UnixMs,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type, sqlx::Type)]
#[serde(rename_all = "lowercase")] // specta v2 改用 serde rename_all（自动应用到 TypeScript）
#[sqlx(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

impl MessageRole {
    /// 序列化为 DeepSeek / OpenAI 协议要求的字符串
    pub fn as_protocol_str(&self) -> &'static str {
        match self {
            MessageRole::User => "user",
            MessageRole::Assistant => "assistant",
            MessageRole::System => "system",
        }
    }
}
