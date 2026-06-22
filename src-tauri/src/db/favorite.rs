//! Favorite 表 CRUD
//!
//! 需提供 `count_by_chat`，供 Chat 头部徽章使用（前端 §4.4）。

use super::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{Favorite, UnixMs};
use serde::Deserialize;
use specta::Type;

/// `update_favorite` 的 patch 入参（前端 camelCase）
#[derive(Debug, Clone, Default, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FavoritePatch {
    pub title: Option<String>,
    pub content: Option<String>,
}

pub async fn create(
    pool: &DbPool,
    title: String,
    content: String,
    source_chat_id: Option<String>,
    source_message_id: Option<String>,
) -> AppResult<Favorite> {
    let now = UnixMs::now();
    let fav = Favorite {
        id: uuid::Uuid::new_v7(uuid::Timestamp::now(uuid::NoContext)).to_string(),
        title,
        content,
        source_chat_id,
        source_message_id,
        created_at: now,
        updated_at: now,
    };
    sqlx::query(
        "INSERT INTO favorites (id, title, content, source_chat_id, source_message_id, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&fav.id)
    .bind(&fav.title)
    .bind(&fav.content)
    .bind(fav.source_chat_id.as_deref())
    .bind(fav.source_message_id.as_deref())
    .bind(fav.created_at)
    .bind(fav.updated_at)
    .execute(pool)
    .await?;
    Ok(fav)
}

pub async fn list_all(pool: &DbPool) -> AppResult<Vec<Favorite>> {
    let favs = sqlx::query_as::<_, Favorite>(
        "SELECT id, title, content, source_chat_id, source_message_id, created_at, updated_at \
         FROM favorites \
         ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(favs)
}

pub async fn get(pool: &DbPool, id: &str) -> AppResult<Favorite> {
    let fav = sqlx::query_as::<_, Favorite>(
        "SELECT id, title, content, source_chat_id, source_message_id, created_at, updated_at \
         FROM favorites \
         WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("favorite:{}", id)))?;
    Ok(fav)
}

/// 仅更新传入的字段；总是一并刷新 `updated_at`。
pub async fn update(pool: &DbPool, id: &str, patch: FavoritePatch) -> AppResult<Favorite> {
    let now = UnixMs::now();

    // 取出当前值以便做"部分更新"
    let current = get(pool, id).await?;

    let new_title = patch.title.unwrap_or(current.title);
    let new_content = patch.content.unwrap_or(current.content);

    sqlx::query("UPDATE favorites SET title = ?, content = ?, updated_at = ? WHERE id = ?")
        .bind(&new_title)
        .bind(&new_content)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;

    get(pool, id).await
}

pub async fn delete(pool: &DbPool, id: &str) -> AppResult<()> {
    sqlx::query("DELETE FROM favorites WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// 根据 source_message_id 查找收藏（用于判断消息是否已被收藏）
pub async fn find_by_message_id(
    pool: &DbPool,
    source_message_id: &str,
) -> AppResult<Option<Favorite>> {
    let fav = sqlx::query_as::<_, Favorite>(
        "SELECT id, title, content, source_chat_id, source_message_id, created_at, updated_at \
         FROM favorites \
         WHERE source_message_id = ? \
         LIMIT 1",
    )
    .bind(source_message_id)
    .fetch_optional(pool)
    .await?;
    Ok(fav)
}

/// 解绑指定消息来源的收藏（用于删除消息时清理关联）。
///
/// 设计：当源消息被删除时，**只解绑来源指针，不删除收藏内容**。
/// - 收藏本身保留（用户可继续手动编辑该收藏）
/// - 后续 `count_by_chat` 不再统计这条（`source_chat_id = NULL`）
///
/// 返回被影响的行数（≥0）。
pub async fn clear_by_message_id(
    pool: &DbPool,
    source_message_id: &str,
) -> AppResult<u64> {
    let now = UnixMs::now();
    let result = sqlx::query(
        "UPDATE favorites \
         SET source_message_id = NULL, source_chat_id = NULL, updated_at = ? \
         WHERE source_message_id = ?",
    )
    .bind(now)
    .bind(source_message_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

pub async fn count_by_chat(pool: &DbPool, chat_id: &str) -> AppResult<i64> {
    let (count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM favorites WHERE source_chat_id = ?",
    )
    .bind(chat_id)
    .fetch_one(pool)
    .await?;
    Ok(count)
}