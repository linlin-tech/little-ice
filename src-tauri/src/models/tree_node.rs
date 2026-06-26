use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::FromRow;

use super::UnixMs;

/// TreeNode（思维树图节点，对应 tree_nodes 表）
///
/// 与 `Chat` 通过相同 `id` 共存：
/// - `tree_nodes.id` == `chats.id`（保持 `messages.chat_id` 关联正常）
/// - `parent_id = NULL` 表示根节点（对应原 chats 表中的对话）
/// - `role_id` 不可为空，默认绑定「默认助手」
#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TreeNode {
    pub id: String,
    pub title: String,
    /// 父节点 id；`None` 表示根节点
    pub parent_id: Option<String>,
    /// 同级排序序号
    #[sqlx(rename = "order")]
    #[serde(rename = "order")]
    pub order: i32,
    pub role_id: String,
    pub created_at: UnixMs,
    pub updated_at: UnixMs,
}

/// 带子节点数的 TreeNode（用于前端展示「N 个子节点」）
#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TreeNodeWithChildren {
    pub id: String,
    pub title: String,
    pub parent_id: Option<String>,
    #[sqlx(rename = "order")]
    #[serde(rename = "order")]
    pub order: i32,
    pub role_id: String,
    pub created_at: UnixMs,
    pub updated_at: UnixMs,
    /// 子节点数量（COUNT 子查询得到）
    pub child_count: i32,
}