//! Group 表 CRUD
//!
//! 分组管理支持三种资源：对话(chat)、收藏(favorite)、模型角色(role)。
//! 删除分组时会级联删除分组内的资源（与「移出分组」区分）。

use sqlx::Row;

use super::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{Group, ResourceType, UnixMs};

/// 根据资源类型返回对应表名
fn table_name(resource_type: ResourceType) -> &'static str {
    match resource_type {
        ResourceType::Chat => "chats",
        ResourceType::Favorite => "favorites",
        ResourceType::Role => "roles",
    }
}

pub async fn create(pool: &DbPool, resource_type: ResourceType, name: String) -> AppResult<Group> {
    let now = UnixMs::now();

    // 计算当前资源类型下的末尾排序号
    let order: i32 = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM groups WHERE resource_type = ?",
    )
    .bind(resource_type.as_str())
    .fetch_one(pool)
    .await? as i32;

    let group = Group {
        id: uuid::Uuid::new_v7(uuid::Timestamp::now(uuid::NoContext)).to_string(),
        resource_type,
        name: name.trim().to_string(),
        sort_order: order,
        created_at: now,
        updated_at: now,
    };

    sqlx::query(
        "INSERT INTO groups (id, resource_type, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&group.id)
    .bind(resource_type.as_str())
    .bind(&group.name)
    .bind(group.sort_order)
    .bind(group.created_at)
    .bind(group.updated_at)
    .execute(pool)
    .await?;

    Ok(group)
}

pub async fn list(pool: &DbPool, resource_type: ResourceType) -> AppResult<Vec<Group>> {
    let groups = sqlx::query_as::<_, Group>(
        "SELECT id, resource_type, name, sort_order, created_at, updated_at \
         FROM groups \
         WHERE resource_type = ? \
         ORDER BY sort_order ASC, created_at ASC",
    )
    .bind(resource_type.as_str())
    .fetch_all(pool)
    .await?;
    Ok(groups)
}

pub async fn get(pool: &DbPool, id: &str) -> AppResult<Group> {
    let group = sqlx::query_as::<_, Group>(
        "SELECT id, resource_type, name, sort_order, created_at, updated_at \
         FROM groups \
         WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("group:{}", id)))?;
    Ok(group)
}

pub async fn rename(pool: &DbPool, id: &str, name: String) -> AppResult<Group> {
    let now = UnixMs::now();
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation("分组名称不能为空".to_string()));
    }

    let result = sqlx::query(
        "UPDATE groups SET name = ?, updated_at = ? WHERE id = ?",
    )
    .bind(trimmed)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("group:{}", id)));
    }

    get(pool, id).await
}

pub async fn delete(pool: &DbPool, id: &str) -> AppResult<()> {
    let group = get(pool, id).await?;

    let mut tx = pool.begin().await?;

    // 先级联删除分组内的资源
    match group.resource_type {
        ResourceType::Chat => delete_group_chats(&mut tx, id).await?,
        ResourceType::Favorite => delete_group_favorites(&mut tx, id).await?,
        ResourceType::Role => delete_group_roles(&mut tx, id).await?,
    }

    let result = sqlx::query("DELETE FROM groups WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("group:{}", id)));
    }

    tx.commit().await?;
    Ok(())
}

/// 删除分组内的所有对话（含 tree_nodes 子孙、messages、chats，并解绑 favorites）
async fn delete_group_chats(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    group_id: &str,
) -> AppResult<()> {
    let rows = sqlx::query("SELECT id FROM chats WHERE group_id = ?")
        .bind(group_id)
        .fetch_all(&mut **tx)
        .await?;

    let mut all_ids: Vec<String> = Vec::new();
    let mut frontier: Vec<String> = Vec::new();
    for r in rows {
        let id: String = r.try_get("id")?;
        all_ids.push(id.clone());
        frontier.push(id);
    }

    // 收集所有子孙 tree node id
    while !frontier.is_empty() {
        let placeholders = frontier.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!("SELECT id FROM tree_nodes WHERE parent_id IN ({})", placeholders);
        let mut q = sqlx::query(&sql);
        for id in &frontier {
            q = q.bind(id);
        }
        let child_rows = q.fetch_all(&mut **tx).await?;
        frontier.clear();
        for r in child_rows {
            if let Ok(Some(id)) = r.try_get::<Option<String>, _>("id") {
                all_ids.push(id.clone());
                frontier.push(id);
            }
        }
    }

    if all_ids.is_empty() {
        return Ok(());
    }

    let placeholders = all_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let now = UnixMs::now();

    // 解绑 favorites.source_chat_id
    let sql = format!(
        "UPDATE favorites SET source_chat_id = NULL, updated_at = ? WHERE source_chat_id IN ({})",
        placeholders
    );
    let mut q = sqlx::query(&sql).bind(now);
    for id in &all_ids {
        q = q.bind(id);
    }
    q.execute(&mut **tx).await?;

    // 解绑 favorites.source_message_id（这些 message 即将被删除）
    let sql = format!(
        "UPDATE favorites SET source_message_id = NULL, updated_at = ? \
         WHERE source_message_id IN (SELECT id FROM messages WHERE chat_id IN ({}))",
        placeholders
    );
    let mut q = sqlx::query(&sql).bind(now);
    for id in &all_ids {
        q = q.bind(id);
    }
    q.execute(&mut **tx).await?;

    // 删除 messages（chats 级联也会删，但显式删除更安全）
    let sql = format!("DELETE FROM messages WHERE chat_id IN ({})", placeholders);
    let mut q = sqlx::query(&sql);
    for id in &all_ids {
        q = q.bind(id);
    }
    q.execute(&mut **tx).await?;

    // 删除 chats（会级联触发 chat_summaries 删除）
    let sql = format!("DELETE FROM chats WHERE id IN ({})", placeholders);
    let mut q = sqlx::query(&sql);
    for id in &all_ids {
        q = q.bind(id);
    }
    q.execute(&mut **tx).await?;

    // 删除 tree_nodes（parent_id 级联会删子孙，但我们已经收集全部 id）
    let sql = format!("DELETE FROM tree_nodes WHERE id IN ({})", placeholders);
    let mut q = sqlx::query(&sql);
    for id in &all_ids {
        q = q.bind(id);
    }
    q.execute(&mut **tx).await?;

    Ok(())
}

/// 删除分组内的所有收藏
async fn delete_group_favorites(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    group_id: &str,
) -> AppResult<()> {
    sqlx::query("DELETE FROM favorites WHERE group_id = ?")
        .bind(group_id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// 删除分组内可删除的角色（被引用的角色会保留，随后由 FK SET NULL 移出分组）
async fn delete_group_roles(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    group_id: &str,
) -> AppResult<()> {
    let rows = sqlx::query("SELECT id FROM roles WHERE group_id = ?")
        .bind(group_id)
        .fetch_all(&mut **tx)
        .await?;

    for r in rows {
        let id: String = r.try_get("id")?;
        // 忽略删除失败（通常是被 chats/tree_nodes 引用）
        let _ = sqlx::query("DELETE FROM roles WHERE id = ? AND is_builtin = 0")
            .bind(&id)
            .execute(&mut **tx)
            .await;
    }

    Ok(())
}

/// 将指定资源移动到某个分组（group_id = None 表示移出分组）
pub async fn move_item(
    pool: &DbPool,
    resource_type: ResourceType,
    item_id: &str,
    group_id: Option<String>,
) -> AppResult<()> {
    let table = table_name(resource_type);

    // 若指定了分组，先校验分组存在且资源类型匹配
    if let Some(ref gid) = group_id {
        let group = get(pool, gid).await?;
        if group.resource_type != resource_type {
            return Err(AppError::Validation(
                "目标分组与资源类型不匹配".to_string(),
            ));
        }
    }

    // 校验资源存在
    let exists: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {} WHERE id = ?", table))
        .bind(item_id)
        .fetch_one(pool)
        .await?;
    if exists == 0 {
        return Err(AppError::NotFound(format!(
            "{}:{}",
            resource_type.as_str(),
            item_id
        )));
    }

    let now = UnixMs::now();
    sqlx::query(&format!(
        "UPDATE {} SET group_id = ?, updated_at = ? WHERE id = ?",
        table
    ))
    .bind(group_id.as_deref())
    .bind(now)
    .bind(item_id)
    .execute(pool)
    .await?;

    Ok(())
}
