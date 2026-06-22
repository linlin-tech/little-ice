//! 集成测试：DB 初始化 + 迁移 + 外键约束。
//!
//! 用临时文件路径跑 `init_with_path`，避免依赖 Tauri runtime。

use std::path::PathBuf;

use little_ice_lib::db::pool::init_with_path;

#[tokio::test]
async fn init_creates_schema_and_enables_foreign_keys() {
    // 1. 准备临时 DB 路径
    let tmp_dir = std::env::temp_dir().join(format!("little-ice-test-{}", std::process::id()));
    std::fs::create_dir_all(&tmp_dir).unwrap();
    let db_path: PathBuf = tmp_dir.join("test.db");
    // 清理上次残留
    let _ = std::fs::remove_file(&db_path);

    // 2. 初始化
    let pool = init_with_path(&db_path)
        .await
        .expect("init_with_path should succeed");

    // 3. 验证：五张表都存在
    for table in &[
        "chats",
        "messages",
        "favorites",
        "settings",
        "chat_summaries",
    ] {
        let (n,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?")
                .bind(table)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(n, 1, "expected table `{table}` to exist");
    }

    // 4. 验证：所有 §3.1 索引都已创建
    for idx in &[
        "idx_chats_updated_at",
        "idx_messages_chat_id",
        "idx_favorites_updated_at",
        "idx_favorites_source_chat_id",
        "idx_chat_summaries_chat_id",
        "idx_chat_summaries_last_message_id",
    ] {
        let (n,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?")
                .bind(idx)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(n, 1, "expected index `{idx}` to exist");
    }

    // 5. 验证：settings 初始行已就位
    let (api_key,): (String,) =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'deepseek_api_key'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(api_key, "");

    // 6. 验证：迁移幂等（再跑一次不会报错）
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migration should be idempotent");

    // 7. 清理
    drop(pool);
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_dir(&tmp_dir);
}

#[tokio::test]
async fn init_with_memory_db_works() {
    let pool = init_with_path(std::path::Path::new(":memory:"))
        .await
        .expect("memory db should init");
    let (n,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM chats")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 0);
}

#[tokio::test]
async fn foreign_keys_are_actually_enforced() {
    // 内存 DB：写一个 chat，关联一条 message，删除 chat 时 message 应被级联删除。
    let pool = init_with_path(std::path::Path::new(":memory:"))
        .await
        .expect("memory db should init");

    let now = chrono::Utc::now().timestamp_millis();
    let chat_id = "chat-1";

    sqlx::query(
        "INSERT INTO chats (id, title, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(chat_id)
    .bind("hello")
    .bind("role_default_assistant")
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind("msg-1")
    .bind(chat_id)
    .bind("user")
    .bind("hi")
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();

    // 校验 message 存在
    let (n,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM messages WHERE chat_id = ?")
        .bind(chat_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 1, "message should be inserted");

    // 删除 chat（应级联删除 message）
    sqlx::query("DELETE FROM chats WHERE id = ?")
        .bind(chat_id)
        .execute(&pool)
        .await
        .unwrap();

    let (n,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM messages WHERE chat_id = ?")
        .bind(chat_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(
        n, 0,
        "message should be CASCADE deleted when chat is deleted"
    );

    // 验证 favorites 的 ON DELETE SET NULL：插入 favorite → 删除 chat → favorite.source_chat_id 变 NULL
    let other_chat = "chat-2";
    sqlx::query(
        "INSERT INTO chats (id, title, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(other_chat)
    .bind("x")
    .bind("role_default_assistant")
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO favorites (id, title, content, source_chat_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind("fav-1")
        .bind("fav")
        .bind("content")
        .bind(other_chat)
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("DELETE FROM chats WHERE id = ?")
        .bind(other_chat)
        .execute(&pool)
        .await
        .unwrap();

    let (src,): (Option<String>,) =
        sqlx::query_as("SELECT source_chat_id FROM favorites WHERE id = 'fav-1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(
        src.is_none(),
        "fav.source_chat_id should be SET NULL when chat is deleted"
    );
}
