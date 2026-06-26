//! tree_nodes 表 CRUD
//!
//! 思维树图功能的数据库访问层。
//!
//! ## 与 chats 表的关系
//!
//! `tree_nodes.id` 与 `chats.id` **共享主键**：
//! - 根节点（`parent_id = NULL`）在两张表中都有对应记录
//! - 子节点（`parent_id != NULL`）**只在 tree_nodes 表中存在**，没有对应的 chats 记录
//!   —— 但 `messages.chat_id` 仍指向其 id（messages 外键引用 chats.id，
//!      SQLite 外键在子节点场景下会因为找不到 chats 记录而无法 INSERT，
//!      所以我们创建子节点时**同时插入一条 chats 记录**以维持外键完整性）
//!
//! ## 删除策略
//!
//! 递归删除一个节点时：
//! 1. 收集该节点及其所有子孙节点 id
//! 2. 在事务中：
//!    - 解绑 favorites（`source_message_id` / `source_chat_id` SET NULL）
//!    - 删除 messages（按 chat_id）
//!    - 删除 chats（会级联删 messages，但显式删更安全）
//!    - 删除 chat_summaries（外键 ON DELETE CASCADE 会自动处理）
//!    - 删除 tree_nodes（按 id 列表）
//! 3. 任意一步失败 → ROLLBACK
//!
//! 之所以先解绑 favorites 再删 messages，是为了保留收藏内容（同 `db::message::delete_pair`）。

use super::DbPool;
use crate::db::role;
use crate::error::{AppError, AppResult};
use crate::models::{TreeNode, TreeNodeWithChildren, UnixMs};

/// 创建节点。
///
/// - `parent_id = None` → 根节点（同时在 chats 表插入一条记录，保持 messages 外键完整）
/// - `parent_id = Some(pid)` → 子节点（同时在 chats 表插入一条记录）
/// - `role_id = None` → 默认绑定「默认助手」
///
/// 返回创建后的 TreeNode。
pub async fn create(
    pool: &DbPool,
    title: String,
    parent_id: Option<String>,
    role_id: Option<String>,
) -> AppResult<TreeNode> {
    let now = UnixMs::now();
    let id = uuid::Uuid::new_v7(uuid::Timestamp::now(uuid::NoContext)).to_string();
    let resolved_role_id = match role_id {
        Some(rid) => rid,
        None => role::get_default(pool).await?.id,
    };

    // 校验父节点存在（若指定）
    if let Some(ref pid) = parent_id {
        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tree_nodes WHERE id = ?")
            .bind(pid)
            .fetch_one(pool)
            .await?;
        if exists == 0 {
            return Err(AppError::NotFound(format!("parent tree node: {}", pid)));
        }
    }

    // 计算同级 order（追加到末尾）
    let order: i32 = sqlx::query_scalar::<_, i64>(
        r#"SELECT COALESCE(MAX("order"), -1) + 1 FROM tree_nodes WHERE parent_id IS ?"#,
    )
    .bind(&parent_id)
    .fetch_one(pool)
    .await? as i32;

    let node = TreeNode {
        id: id.clone(),
        title,
        parent_id: parent_id.clone(),
        order,
        role_id: resolved_role_id.clone(),
        created_at: now,
        updated_at: now,
    };

    let mut tx = pool.begin().await?;

    // 1. 插入 tree_nodes
    sqlx::query(
        r#"INSERT INTO tree_nodes (id, title, parent_id, "order", role_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&node.id)
    .bind(&node.title)
    .bind(&node.parent_id)
    .bind(node.order)
    .bind(&node.role_id)
    .bind(node.created_at)
    .bind(node.updated_at)
    .execute(&mut *tx)
    .await?;

    // 2. 同步插入 chats（保持 messages 外键完整；根节点和子节点都需要）
    sqlx::query(
        "INSERT INTO chats (id, title, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&node.id)
    .bind(&node.title)
    .bind(&node.role_id)
    .bind(node.created_at)
    .bind(node.updated_at)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(node)
}

/// 列出所有根节点（`parent_id IS NULL`），按 `updated_at DESC` 排序，带子节点数。
pub async fn list_roots(pool: &DbPool) -> AppResult<Vec<TreeNodeWithChildren>> {
    let nodes = sqlx::query_as::<_, TreeNodeWithChildren>(
        r#"SELECT
             t.id, t.title, t.parent_id, t."order", t.role_id, t.created_at, t.updated_at,
             (SELECT COUNT(*) FROM tree_nodes c WHERE c.parent_id = t.id) AS child_count
           FROM tree_nodes t
           WHERE t.parent_id IS NULL
           ORDER BY t.updated_at DESC"#,
    )
    .fetch_all(pool)
    .await?;
    Ok(nodes)
}

/// 查询某节点的直接子节点（带子节点数），按 `order` 排序。
pub async fn list_children(pool: &DbPool, parent_id: &str) -> AppResult<Vec<TreeNodeWithChildren>> {
    let nodes = sqlx::query_as::<_, TreeNodeWithChildren>(
        r#"SELECT
             t.id, t.title, t.parent_id, t."order", t.role_id, t.created_at, t.updated_at,
             (SELECT COUNT(*) FROM tree_nodes c WHERE c.parent_id = t.id) AS child_count
           FROM tree_nodes t
           WHERE t.parent_id = ?
           ORDER BY t."order" ASC"#,
    )
    .bind(parent_id)
    .fetch_all(pool)
    .await?;
    Ok(nodes)
}

/// 查询整棵树（所有节点），一次性返回扁平列表。
///
/// 用于前端初始化时加载完整树结构。节点数较大时可改为懒加载。
pub async fn list_all(pool: &DbPool) -> AppResult<Vec<TreeNodeWithChildren>> {
    let nodes = sqlx::query_as::<_, TreeNodeWithChildren>(
        r#"SELECT
             t.id, t.title, t.parent_id, t."order", t.role_id, t.created_at, t.updated_at,
             (SELECT COUNT(*) FROM tree_nodes c WHERE c.parent_id = t.id) AS child_count
           FROM tree_nodes t
           ORDER BY t."order" ASC"#,
    )
    .fetch_all(pool)
    .await?;
    Ok(nodes)
}

/// 获取单个节点（带子节点数）。
pub async fn get(pool: &DbPool, id: &str) -> AppResult<TreeNodeWithChildren> {
    let node = sqlx::query_as::<_, TreeNodeWithChildren>(
        r#"SELECT
             t.id, t.title, t.parent_id, t."order", t.role_id, t.created_at, t.updated_at,
             (SELECT COUNT(*) FROM tree_nodes c WHERE c.parent_id = t.id) AS child_count
           FROM tree_nodes t
           WHERE t.id = ?"#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("tree node: {}", id)))?;
    Ok(node)
}

/// 重命名节点（同步更新 tree_nodes 和 chats 的 title）。
pub async fn rename(pool: &DbPool, id: &str, title: String) -> AppResult<TreeNode> {
    let now = UnixMs::now();
    let mut tx = pool.begin().await?;

    let result = sqlx::query(
        r#"UPDATE tree_nodes SET title = ?, updated_at = ? WHERE id = ?"#,
    )
    .bind(&title)
    .bind(now)
    .bind(id)
    .execute(&mut *tx)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("tree node: {}", id)));
    }

    // 同步更新 chats.title（若存在对应记录）
    sqlx::query("UPDATE chats SET title = ?, updated_at = ? WHERE id = ?")
        .bind(&title)
        .bind(now)
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    // 重新查询返回完整 TreeNode
    let node = sqlx::query_as::<_, TreeNode>(
        r#"SELECT id, title, parent_id, "order", role_id, created_at, updated_at
           FROM tree_nodes WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(node)
}

/// 修改节点绑定的 role（同步更新 tree_nodes 和 chats）。
pub async fn set_role(pool: &DbPool, id: &str, role_id: String) -> AppResult<TreeNode> {
    let now = UnixMs::now();
    let mut tx = pool.begin().await?;

    let result = sqlx::query(
        r#"UPDATE tree_nodes SET role_id = ?, updated_at = ? WHERE id = ?"#,
    )
    .bind(&role_id)
    .bind(now)
    .bind(id)
    .execute(&mut *tx)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("tree node: {}", id)));
    }

    sqlx::query("UPDATE chats SET role_id = ?, updated_at = ? WHERE id = ?")
        .bind(&role_id)
        .bind(now)
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    let node = sqlx::query_as::<_, TreeNode>(
        r#"SELECT id, title, parent_id, "order", role_id, created_at, updated_at
           FROM tree_nodes WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(node)
}

/// 更新节点的 `updated_at`（用于消息新增时影响排序）。
pub async fn touch(pool: &DbPool, id: &str) -> AppResult<()> {
    let now = UnixMs::now();
    let mut tx = pool.begin().await?;
    sqlx::query(r#"UPDATE tree_nodes SET updated_at = ? WHERE id = ?"#)
        .bind(now)
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE chats SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(())
}

/// 递归收集某节点及其所有子孙节点的 id。
///
/// 用迭代式 BFS（避免递归深度过大）。
pub async fn collect_descendants(pool: &DbPool, root_id: &str) -> AppResult<Vec<String>> {
    let mut result = vec![root_id.to_string()];
    let mut frontier = vec![root_id.to_string()];

    while !frontier.is_empty() {
        // 一次性查询这一层的所有子节点
        let placeholders = frontier.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            r#"SELECT id FROM tree_nodes WHERE parent_id IN ({})"#,
            placeholders
        );
        let mut q = sqlx::query(&sql);
        for id in &frontier {
            q = q.bind(id);
        }
        let rows = q.fetch_all(pool).await?;

        let next: Vec<String> = rows
            .into_iter()
            .filter_map(|r| sqlx::Row::try_get::<Option<String>, _>(&r, "id").ok().flatten())
            .collect();

        if next.is_empty() {
            break;
        }
        result.extend(next.iter().cloned());
        frontier = next;
    }

    Ok(result)
}

/// 递归删除节点及其所有子孙节点，同时删除关联的 chats / messages / favorites 解绑。
///
/// 流程（事务内）：
/// 1. 收集所有待删除节点 id（含自身 + 子孙）
/// 2. 解绑 favorites（`source_message_id` / `source_chat_id` SET NULL）
/// 3. 删除 messages（按 chat_id IN (...)）
/// 4. 删除 chats（按 id IN (...)，会级联触发 chat_summaries 删除）
/// 5. 删除 tree_nodes（按 id IN (...)）
///
/// 任意失败 → ROLLBACK。
pub async fn delete_recursive(pool: &DbPool, id: &str) -> AppResult<()> {
    // 1. 收集所有待删除 id
    let ids = collect_descendants(pool, id).await?;
    if ids.is_empty() {
        return Ok(());
    }

    let mut tx = pool.begin().await?;

    // 2. 解绑 favorites（先按 source_chat_id，再按 source_message_id）
    //    使用子查询避免 IN 列表过长
    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");

    // 2a. 解绑 source_chat_id
    let sql = format!(
        "UPDATE favorites SET source_chat_id = NULL, updated_at = ? WHERE source_chat_id IN ({})",
        placeholders
    );
    let mut q = sqlx::query(&sql).bind(UnixMs::now());
    for id in &ids {
        q = q.bind(id);
    }
    q.execute(&mut *tx).await?;

    // 2b. 解绑 source_message_id（这些 message 即将被删除）
    let sql = format!(
        "UPDATE favorites SET source_message_id = NULL, updated_at = ? \
         WHERE source_message_id IN (SELECT id FROM messages WHERE chat_id IN ({}))",
        placeholders
    );
    let mut q = sqlx::query(&sql).bind(UnixMs::now());
    for id in &ids {
        q = q.bind(id);
    }
    q.execute(&mut *tx).await?;

    // 3. 删除 messages
    let sql = format!("DELETE FROM messages WHERE chat_id IN ({})", placeholders);
    let mut q = sqlx::query(&sql);
    for id in &ids {
        q = q.bind(id);
    }
    q.execute(&mut *tx).await?;

    // 4. 删除 chats（chat_summaries 的 ON DELETE CASCADE 会自动删）
    let sql = format!("DELETE FROM chats WHERE id IN ({})", placeholders);
    let mut q = sqlx::query(&sql);
    for id in &ids {
        q = q.bind(id);
    }
    q.execute(&mut *tx).await?;

    // 5. 删除 tree_nodes
    let sql = format!("DELETE FROM tree_nodes WHERE id IN ({})", placeholders);
    let mut q = sqlx::query(&sql);
    for id in &ids {
        q = q.bind(id);
    }
    q.execute(&mut *tx).await?;

    tx.commit().await?;
    Ok(())
}

/// 移动节点：修改 parent_id 和 order。
///
/// 用于拖拽排序。`new_parent_id = None` 表示移到根级。
pub async fn move_node(
    pool: &DbPool,
    id: &str,
    new_parent_id: Option<String>,
    new_order: i32,
) -> AppResult<TreeNode> {
    let now = UnixMs::now();
    let mut tx = pool.begin().await?;

    let result = sqlx::query(
        r#"UPDATE tree_nodes SET parent_id = ?, "order" = ?, updated_at = ? WHERE id = ?"#,
    )
    .bind(&new_parent_id)
    .bind(new_order)
    .bind(now)
    .bind(id)
    .execute(&mut *tx)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("tree node: {}", id)));
    }

    tx.commit().await?;

    let node = sqlx::query_as::<_, TreeNode>(
        r#"SELECT id, title, parent_id, "order", role_id, created_at, updated_at
           FROM tree_nodes WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(node)
}