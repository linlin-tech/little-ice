//! 数据库访问层
//!
//! 全部 SQL 通过 `sqlx::query` / `sqlx::query_as` 执行。
//! **不**使用 `query!` 宏（避免编译期 DB 依赖）。

pub mod chat;
pub mod favorite;
pub mod message;
pub mod pool;
pub mod role;
pub mod settings;
pub mod summary;

pub use pool::{DbPool, init};
pub use sqlx::SqlitePool;
