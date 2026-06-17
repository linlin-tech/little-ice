use serde::{Deserialize, Serialize};
use specta::Type;

use super::UnixMs;

/// Role（前端 Role，对应 §3 数据模型）
#[derive(Debug, Clone, Serialize, Deserialize, Type, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Role {
    pub id: String,
    pub name: String,
    pub responsibility: String,
    pub is_builtin: bool,
    pub created_at: UnixMs,
    pub updated_at: UnixMs,
}
