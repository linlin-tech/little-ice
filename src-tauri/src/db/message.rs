//! Message 表 CRUD
//!
//! V1.1：UUIDv7 的 id 已时间有序，列表查询 `ORDER BY id`（不再用 `created_at`）。

use super::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{Message, MessageRole, UnixMs};

pub async fn create(
    pool: &DbPool,
    chat_id: &str,
    role: MessageRole,
    content: String,
) -> AppResult<Message> {
    let now = UnixMs::now();
    let msg = Message {
        id: uuid::Uuid::new_v7(uuid::Timestamp::now(uuid::NoContext)).to_string(),
        chat_id: chat_id.to_string(),
        role,
        content,
        created_at: now,
    };
    sqlx::query(
        "INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&msg.id)
    .bind(&msg.chat_id)
    .bind(msg.role.as_protocol_str())
    .bind(&msg.content)
    .bind(msg.created_at)
    .execute(pool)
    .await?;
    Ok(msg)
}

pub async fn list_by_chat(pool: &DbPool, chat_id: &str) -> AppResult<Vec<Message>> {
    let messages = sqlx::query_as::<_, Message>(
        "SELECT id, chat_id, role, content, created_at \
         FROM messages \
         WHERE chat_id = ? \
         ORDER BY id",
    )
    .bind(chat_id)
    .fetch_all(pool)
    .await?;
    Ok(messages)
}

pub async fn update_content(pool: &DbPool, id: &str, content: &str) -> AppResult<()> {
    sqlx::query("UPDATE messages SET content = ? WHERE id = ?")
        .bind(content)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// 查找某条 assistant 消息**之前**最近一条 user 消息（同一 chat）。
///
/// 用于删除 AI 回复时定位配对的 user 提问，保证一次"删除一组"。
///
/// 返回 `None` 表示没找到（理论上 AI 回复一定有配对 user，但极端情况下：
/// 流启动失败只写了一半 — 此时退化只删 assistant 也安全）。
pub async fn find_preceding_user(
    pool: &DbPool,
    chat_id: &str,
    assistant_id: &str,
) -> AppResult<Option<Message>> {
    let msg = sqlx::query_as::<_, Message>(
        "SELECT id, chat_id, role, content, created_at \
         FROM messages \
         WHERE chat_id = ? AND role = 'user' AND id < ? \
         ORDER BY id DESC \
         LIMIT 1",
    )
    .bind(chat_id)
    .bind(assistant_id)
    .fetch_optional(pool)
    .await?;
    Ok(msg)
}

/// 删除一对配对消息（user + assistant），并**在同一事务中**清理
/// `favorites` 表里 `source_message_id = assistant_id` 的记录（解绑来源指针）。
///
/// 行为：
/// 1. `BEGIN` → 校验两条消息都在该 chat → 解绑 favorites → 删两条 messages → `COMMIT`
/// 2. 任何一步失败 → `ROLLBACK`，原状不动
///
/// 设计取舍：
/// - 用 `UPDATE ... SET NULL` 而非 `DELETE` 是为了**保留收藏内容**；
///   用户可能对收藏内容做了后续编辑，删除消息不该抹掉收藏。
/// - `count_by_chat` 只统计 `source_chat_id IS NOT NULL` 的记录，
///   所以 Chat 头部的徽章会随之下降，无需额外通知。
pub async fn delete_pair(
    pool: &DbPool,
    chat_id: &str,
    user_id: &str,
    assistant_id: &str,
) -> AppResult<()> {
    // 启动事务
    let mut tx = pool.begin().await?;

    // 1) 校验两条消息都属于该 chat（防止误删其他 chat 的消息）
    let rows = sqlx::query(
        "SELECT id FROM messages WHERE chat_id = ? AND id IN (?, ?)",
    )
    .bind(chat_id)
    .bind(user_id)
    .bind(assistant_id)
    .fetch_all(&mut *tx)
    .await?;

    if rows.len() < 2 {
        return Err(AppError::NotFound(format!(
            "message pair not found in chat {chat_id}: user={user_id}, assistant={assistant_id}"
        )));
    }

    // 2) 解绑 favorites（先清关联，最后删 messages）
    sqlx::query(
        "UPDATE favorites \
         SET source_message_id = NULL, source_chat_id = NULL, updated_at = ? \
         WHERE source_message_id = ?",
    )
    .bind(UnixMs::now())
    .bind(assistant_id)
    .execute(&mut *tx)
    .await?;

    // 3) 删除两条消息
    sqlx::query("DELETE FROM messages WHERE id = ?")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM messages WHERE id = ?")
        .bind(assistant_id)
        .execute(&mut *tx)
        .await?;

    // 4) 提交
    tx.commit().await?;
    Ok(())
}

/// 退化路径：只删 assistant 一条（找不到配对 user 时）。
///
/// 同样会先解绑 favorites（事务内），再删消息。
pub async fn delete_orphan_assistant(
    pool: &DbPool,
    chat_id: &str,
    assistant_id: &str,
) -> AppResult<()> {
    let mut tx = pool.begin().await?;

    let row = sqlx::query("SELECT id FROM messages WHERE chat_id = ? AND id = ?")
        .bind(chat_id)
        .bind(assistant_id)
        .fetch_optional(&mut *tx)
        .await?;

    if row.is_none() {
        return Err(AppError::NotFound(format!(
            "assistant message not found: {assistant_id}"
        )));
    }

    // 解绑 favorites
    sqlx::query(
        "UPDATE favorites \
         SET source_message_id = NULL, source_chat_id = NULL, updated_at = ? \
         WHERE source_message_id = ?",
    )
    .bind(UnixMs::now())
    .bind(assistant_id)
    .execute(&mut *tx)
    .await?;

    // 删消息
    sqlx::query("DELETE FROM messages WHERE id = ?")
        .bind(assistant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}