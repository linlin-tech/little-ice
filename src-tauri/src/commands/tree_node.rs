//! TreeNode 命令（思维树图功能）
//!
//! 命令签名与前端 `src/lib/tauri.ts` 严格 1:1 对齐。
//!
//! ## 命令清单
//! - `create_tree_node`：创建节点（根/子）
//! - `list_tree_roots`：列出根节点（带 childCount）
//! - `list_tree_children`：列出直接子节点（懒加载）
//! - `list_all_tree_nodes`：列出全部节点（扁平，前端构建树）
//! - `get_tree_node`：获取单个节点
//! - `rename_tree_node`：重命名
//! - `set_tree_node_role`：修改关联角色
//! - `delete_tree_node`：递归删除（含子孙 + messages + favorites 解绑）
//! - `move_tree_node`：移动节点（改 parent_id + order）

use specta::specta;
use tauri::State;

use crate::error::AppResult;
use crate::models::{TreeNode, TreeNodeWithChildren};
use crate::state::AppState;

/// 创建节点。
///
/// - `parent_id = null` → 根节点
/// - `parent_id = "xxx"` → 子节点
/// - `role_id = null` → 默认绑定「默认助手」
#[tauri::command]
#[specta]
pub async fn create_tree_node(
    state: State<'_, AppState>,
    title: String,
    parent_id: Option<String>,
    role_id: Option<String>,
) -> AppResult<TreeNode> {
    crate::db::tree_node::create(&state.db, title, parent_id, role_id).await
}

/// 列出所有根节点（`parent_id IS NULL`），按 `updated_at DESC`，带 childCount。
#[tauri::command]
#[specta]
pub async fn list_tree_roots(state: State<'_, AppState>) -> AppResult<Vec<TreeNodeWithChildren>> {
    crate::db::tree_node::list_roots(&state.db).await
}

/// 列出某节点的直接子节点（懒加载用），按 `order` 排序，带 childCount。
#[tauri::command]
#[specta]
pub async fn list_tree_children(
    state: State<'_, AppState>,
    parent_id: String,
) -> AppResult<Vec<TreeNodeWithChildren>> {
    crate::db::tree_node::list_children(&state.db, &parent_id).await
}

/// 列出全部节点（扁平列表），用于前端初始化加载整棵树。
#[tauri::command]
#[specta]
pub async fn list_all_tree_nodes(
    state: State<'_, AppState>,
) -> AppResult<Vec<TreeNodeWithChildren>> {
    crate::db::tree_node::list_all(&state.db).await
}

/// 获取单个节点（带 childCount）。
#[tauri::command]
#[specta]
pub async fn get_tree_node(
    state: State<'_, AppState>,
    id: String,
) -> AppResult<TreeNodeWithChildren> {
    crate::db::tree_node::get(&state.db, &id).await
}

/// 重命名节点（同步更新 tree_nodes 和 chats 的 title）。
#[tauri::command]
#[specta]
pub async fn rename_tree_node(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> AppResult<TreeNode> {
    crate::db::tree_node::rename(&state.db, &id, title).await
}

/// 修改节点绑定的角色（同步更新 tree_nodes 和 chats）。
#[tauri::command]
#[specta]
pub async fn set_tree_node_role(
    state: State<'_, AppState>,
    id: String,
    role_id: String,
) -> AppResult<TreeNode> {
    crate::db::tree_node::set_role(&state.db, &id, role_id).await
}

/// 递归删除节点（含子孙 + 关联 messages + favorites 解绑）。
///
/// 在事务内执行，任意失败回滚。
#[tauri::command]
#[specta]
pub async fn delete_tree_node(state: State<'_, AppState>, id: String) -> AppResult<()> {
    crate::db::tree_node::delete_recursive(&state.db, &id).await
}

/// 移动节点（改 parent_id + order），用于拖拽排序。
///
/// `new_parent_id = null` 表示移到根级。
#[tauri::command]
#[specta]
pub async fn move_tree_node(
    state: State<'_, AppState>,
    id: String,
    new_parent_id: Option<String>,
    new_order: i32,
) -> AppResult<TreeNode> {
    crate::db::tree_node::move_node(&state.db, &id, new_parent_id, new_order).await
}
