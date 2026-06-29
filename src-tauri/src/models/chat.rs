use serde::{Deserialize, Serialize};
use specta::Type;

use super::UnixMs;

/// Chat（前端 Chat，对应 §3 数据模型）
#[derive(Debug, Clone, Serialize, Deserialize, Type, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Chat {
    pub id: String,
    pub title: String,
    pub role_id: String,
    /// 所属分组 id；NULL 表示未分组
    pub group_id: Option<String>,
    pub created_at: UnixMs,
    pub updated_at: UnixMs,
}
