//! Settings (key-value) 访问层
//!
//! 当前仅使用 `deepseek_api_key` 一个 key，但保持通用以备扩展。

use super::DbPool;
use crate::error::AppResult;

pub async fn get(pool: &DbPool, key: &str) -> AppResult<Option<String>> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await?;
    Ok(row.map(|(v,)| v))
}

pub async fn set(pool: &DbPool, key: &str, value: &str) -> AppResult<()> {
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?, ?) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;
    Ok(())
}
