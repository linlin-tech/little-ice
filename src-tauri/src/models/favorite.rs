use serde::{Deserialize, Serialize};
use specta::Type;

use super::UnixMs;

/// Favorite（前端 Favorite，对应 §3 数据模型）
#[derive(Debug, Clone, Serialize, Deserialize, Type, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Favorite {
    pub id: String,
    pub title: String,
    pub content: String,
    /// 来源 Chat id；手动创建时为 None
    pub source_chat_id: Option<String>,
    /// 来源 Message id；手动创建时为 None
    pub source_message_id: Option<String>,
    pub created_at: UnixMs,
    pub updated_at: UnixMs,
}
