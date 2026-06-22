//! Chat 表 CRUD

use super::DbPool;
use crate::db::role;
use crate::error::{AppError, AppResult};
use crate::models::{Chat, UnixMs};

pub async fn create(pool: &DbPool, title: String) -> AppResult<Chat> {
    let now = UnixMs::now();
    // 新建 chat 默认绑定「默认助手」
    let default_role = role::get_default(pool).await?;
    let chat = Chat {
        id: uuid::Uuid::new_v7(uuid::Timestamp::now(uuid::NoContext)).to_string(),
        title,
        role_id: default_role.id,
        created_at: now,
        updated_at: now,
    };
    sqlx::query(
        "INSERT INTO chats (id, title, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&chat.id)
    .bind(&chat.title)
    .bind(&chat.role_id)
    .bind(chat.created_at)
    .bind(chat.updated_at)
    .execute(pool)
    .await?;
    Ok(chat)
}

pub async fn list_all(pool: &DbPool) -> AppResult<Vec<Chat>> {
    let chats = sqlx::query_as::<_, Chat>(
        "SELECT id, title, role_id, created_at, updated_at FROM chats ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(chats)
}

pub async fn get(pool: &DbPool, id: &str) -> AppResult<Chat> {
    let chat = sqlx::query_as::<_, Chat>(
        "SELECT id, title, role_id, created_at, updated_at FROM chats WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("chat:{}", id)))?;
    Ok(chat)
}

pub async fn rename(pool: &DbPool, id: &str, title: String) -> AppResult<Chat> {
    let now = UnixMs::now();
    sqlx::query("UPDATE chats SET title = ?, updated_at = ? WHERE id = ?")
        .bind(&title)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
    get(pool, id).await
}

/// 修改 chat 绑定的 role
pub async fn set_role(pool: &DbPool, id: &str, role_id: String) -> AppResult<Chat> {
    let now = UnixMs::now();
    sqlx::query("UPDATE chats SET role_id = ?, updated_at = ? WHERE id = ?")
        .bind(&role_id)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
    get(pool, id).await
}

pub async fn delete(pool: &DbPool, id: &str) -> AppResult<()> {
    sqlx::query("DELETE FROM chats WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// 更新 chat 的 `updated_at`（用于消息新增/流式完成时影响列表排序）
pub async fn touch(pool: &DbPool, id: &str) -> AppResult<()> {
    let now = UnixMs::now();
    sqlx::query("UPDATE chats SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
