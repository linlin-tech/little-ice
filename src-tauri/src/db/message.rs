//! Message 表 CRUD
//!
//! V1.1：UUIDv7 的 id 已时间有序，列表查询 `ORDER BY id`（不再用 `created_at`）。

use super::DbPool;
use crate::error::AppResult;
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
