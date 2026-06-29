use serde::{Deserialize, Serialize};
use specta::Type;

use super::UnixMs;

/// 资源类型（分组管理所支持的三种资源）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, sqlx::Type)]
#[serde(rename_all = "camelCase")]
#[sqlx(rename_all = "snake_case")]
pub enum ResourceType {
    Chat,
    Favorite,
    Role,
}

impl ResourceType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ResourceType::Chat => "chat",
            ResourceType::Favorite => "favorite",
            ResourceType::Role => "role",
        }
    }
}

impl std::str::FromStr for ResourceType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "chat" => Ok(ResourceType::Chat),
            "favorite" => Ok(ResourceType::Favorite),
            "role" => Ok(ResourceType::Role),
            _ => Err(format!("unknown resource_type: {s}")),
        }
    }
}

/// 分组（对话 / 收藏 / 模型角色）
#[derive(Debug, Clone, Serialize, Deserialize, Type, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: String,
    pub resource_type: ResourceType,
    pub name: String,
    pub sort_order: i32,
    pub created_at: UnixMs,
    pub updated_at: UnixMs,
}
