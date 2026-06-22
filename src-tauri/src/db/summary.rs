//! ChatSummary 表 CRUD
//!
//! 按 333 原则，每个 chat 最多保留 3 条最新摘要。

use super::DbPool;
use crate::error::AppResult;
use crate::models::ChatSummary;

/// 查询某 chat 的最新摘要（按 created_at 倒序取第一条）
pub async fn find_latest_by_chat(pool: &DbPool, chat_id: &str) -> AppResult<Option<ChatSummary>> {
    let summary = sqlx::query_as::<_, ChatSummary>(
        "SELECT id, chat_id, content, keywords, last_message_id, created_at \
         FROM chat_summaries \
         WHERE chat_id = ? \
         ORDER BY created_at DESC \
         LIMIT 1",
    )
    .bind(chat_id)
    .fetch_optional(pool)
    .await?;
    Ok(summary)
}

/// 查询某 chat 的最近若干条摘要（按时间正序）。
///
/// 用于 333 原则下构造上下文时一次性取出多个摘要。
pub async fn list_recent_by_chat(
    pool: &DbPool,
    chat_id: &str,
    limit: usize,
) -> AppResult<Vec<ChatSummary>> {
    let summaries = sqlx::query_as::<_, ChatSummary>(
        "SELECT id, chat_id, content, keywords, last_message_id, created_at \
         FROM chat_summaries \
         WHERE chat_id = ? \
         ORDER BY created_at ASC \
         LIMIT ?",
    )
    .bind(chat_id)
    .bind(limit as i64)
    .fetch_all(pool)
    .await?;
    Ok(summaries)
}

/// 插入新摘要并清理旧摘要，使每个 chat 最多保留 `MAX_SUMMARIES` 条。
const MAX_SUMMARIES: i64 = 3;

pub async fn replace_for_chat(
    pool: &DbPool,
    chat_id: &str,
    summary: &ChatSummary,
) -> AppResult<()> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        "INSERT INTO chat_summaries \
         (id, chat_id, content, keywords, last_message_id, created_at) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&summary.id)
    .bind(&summary.chat_id)
    .bind(&summary.content)
    .bind(&summary.keywords)
    .bind(&summary.last_message_id)
    .bind(summary.created_at)
    .execute(&mut *tx)
    .await?;

    // 仅保留最新的 3 条摘要
    sqlx::query(
        "DELETE FROM chat_summaries \
         WHERE chat_id = ? \
         AND id NOT IN ( \
           SELECT id FROM chat_summaries \
           WHERE chat_id = ? \
           ORDER BY created_at DESC \
           LIMIT ? \
         )",
    )
    .bind(chat_id)
    .bind(chat_id)
    .bind(MAX_SUMMARIES)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}
