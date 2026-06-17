//! Role 表 CRUD
//!
//! 内置角色「默认助手」由迁移文件插入，id 固定为 `role_default_assistant`。

use super::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{Role, UnixMs};

/// 内置「默认助手」角色的固定 id
pub const DEFAULT_ROLE_ID: &str = "role_default_assistant";

pub async fn create(pool: &DbPool, name: String, responsibility: String) -> AppResult<Role> {
    let now = UnixMs::now();
    let role = Role {
        id: uuid::Uuid::new_v7(uuid::Timestamp::now(uuid::NoContext)).to_string(),
        name,
        responsibility,
        is_builtin: false,
        created_at: now,
        updated_at: now,
    };
    sqlx::query(
        "INSERT INTO roles (id, name, responsibility, is_builtin, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&role.id)
    .bind(&role.name)
    .bind(&role.responsibility)
    .bind(role.is_builtin)
    .bind(role.created_at)
    .bind(role.updated_at)
    .execute(pool)
    .await?;
    Ok(role)
}

pub async fn list_all(pool: &DbPool) -> AppResult<Vec<Role>> {
    let roles = sqlx::query_as::<_, Role>(
        "SELECT id, name, responsibility, is_builtin, created_at, updated_at \
         FROM roles \
         ORDER BY is_builtin DESC, updated_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(roles)
}

pub async fn get(pool: &DbPool, id: &str) -> AppResult<Role> {
    let role = sqlx::query_as::<_, Role>(
        "SELECT id, name, responsibility, is_builtin, created_at, updated_at \
         FROM roles \
         WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("role:{}", id)))?;
    Ok(role)
}

pub async fn get_default(pool: &DbPool) -> AppResult<Role> {
    get(pool, DEFAULT_ROLE_ID).await
}

pub async fn update(
    pool: &DbPool,
    id: &str,
    name: Option<String>,
    responsibility: Option<String>,
) -> AppResult<Role> {
    let current = get(pool, id).await?;
    if current.is_builtin {
        return Err(AppError::Validation("不能修改系统内置角色".to_string()));
    }

    let new_name = name.unwrap_or(current.name);
    let new_responsibility = responsibility.unwrap_or(current.responsibility);
    let now = UnixMs::now();

    sqlx::query(
        "UPDATE roles SET name = ?, responsibility = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&new_name)
    .bind(&new_responsibility)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await?;

    get(pool, id).await
}

pub async fn delete(pool: &DbPool, id: &str) -> AppResult<()> {
    let current = get(pool, id).await?;
    if current.is_builtin {
        return Err(AppError::Validation("不能删除系统内置角色".to_string()));
    }

    // 检查是否仍被 chat 引用（外键 RESTRICT 也会拦，但提前给更友好提示）
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM chats WHERE role_id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
    if count > 0 {
        return Err(AppError::Validation(
            "该角色仍被对话引用，无法删除".to_string(),
        ));
    }

    sqlx::query("DELETE FROM roles WHERE id = ?").bind(id).execute(pool).await?;
    Ok(())
}

/// 根据 chat_id 查询当前绑定的 role
pub async fn get_by_chat_id(pool: &DbPool, chat_id: &str) -> AppResult<Role> {
    let role = sqlx::query_as::<_, Role>(
        "SELECT r.id, r.name, r.responsibility, r.is_builtin, r.created_at, r.updated_at \
         FROM roles r \
         JOIN chats c ON c.role_id = r.id \
         WHERE c.id = ?",
    )
    .bind(chat_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("role for chat:{}", chat_id)))?;
    Ok(role)
}
