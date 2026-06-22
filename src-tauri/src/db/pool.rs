//! SQLite 连接池初始化
//!
//! 数据库文件位于 Tauri 管理的 `app_data_dir()` 下。
//! - macOS: `~/Library/Application Support/com.littleice.app/little-ice.db`
//! - Windows / Linux 由 Tauri 自动映射到平台对应路径。
//!
//! 本任务只负责"DB 初始化 + 迁移 + 开启外键"，业务 CRUD 在 `db/{chat,message,...}.rs` 中。

use std::path::{Path, PathBuf};
use std::str::FromStr;

use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use tauri::Manager;

use crate::error::{AppError, AppResult};

/// 项目内统一别名。
pub type DbPool = SqlitePool;

/// 初始化 SQLite 连接池 + 运行迁移（Tauri 入口）。
///
/// 步骤：
/// 1. 解析 Tauri `app_data_dir()`（跨平台）
/// 2. 创建目录（不存在则建）
/// 3. 拼装 `sqlite://<path>?mode=rwc` URL
/// 4. 配置 `SqliteConnectOptions`（WAL + **外键**）
/// 5. 建池（max_connections = 5）
/// 6. `sqlx::migrate!` 自动应用 `./migrations/*.sql`
///
/// 错误全部归一化为 `AppError`（`Database` / `Validation` / `Internal`）。
pub async fn init(app: &tauri::App) -> AppResult<DbPool> {
    // 1. 解析应用数据目录（由 Tauri 跨平台管理）
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("resolve app_data_dir: {e}")))?;

    // 2. 确保目录存在
    std::fs::create_dir_all(&app_data_dir).map_err(|e| {
        AppError::Internal(anyhow::anyhow!(
            "create app_data_dir {}: {e}",
            app_data_dir.display()
        ))
    })?;

    // 3. 拼接 DB 文件路径
    let db_path = app_data_dir.join("little-ice.db");
    init_with_path(&db_path).await
}

/// Tauri 无关的纯 sqlx 初始化（便于测试）。
///
/// `db_path` 可以是 `:memory:` 或任意文件路径；目录不存在会自动创建。
pub async fn init_with_path(db_path: &Path) -> AppResult<DbPool> {
    // 1. 如果是文件路径，确保父目录存在
    if let Some(parent) = db_path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| {
                AppError::Internal(anyhow::anyhow!(
                    "create db parent dir {}: {e}",
                    parent.display()
                ))
            })?;
        }
    }

    // 2. 拼接 DB URL
    let db_path_buf: PathBuf = db_path.to_path_buf();
    let db_url = if db_path_buf == PathBuf::from(":memory:") {
        "sqlite::memory:".to_string()
    } else {
        format!("sqlite://{}?mode=rwc", db_path_buf.display())
    };

    // 3. 配置 SQLite 连接选项（WAL + 外键 ON）
    let opts = SqliteConnectOptions::from_str(&db_url)
        .map_err(|e| AppError::Validation(format!("invalid sqlite url {db_url}: {e}")))?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true); // ← 开启外键约束（§5.1）

    // 4. 建立连接池
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(opts)
        .await?;

    // 5. 运行迁移（自动跟踪 schema_versions 表）
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| AppError::Database(sqlx::Error::Migrate(Box::new(e))))?;

    // 6. 健康检查：确认外键 PRAGMA 实际生效
    let (fk_enabled,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM pragma_foreign_keys WHERE foreign_keys = 1")
            .fetch_one(&pool)
            .await?;
    if fk_enabled != 1 {
        return Err(AppError::Internal(anyhow::anyhow!(
            "foreign_keys PRAGMA is not enabled after init"
        )));
    }

    tracing::info!(db_path = %db_path_buf.display(), "database initialized");
    Ok(pool)
}
