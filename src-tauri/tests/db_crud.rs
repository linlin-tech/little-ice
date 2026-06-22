//! 集成测试：数据访问层 CRUD（不依赖 Tauri runtime）
//!
//! 直接用 `db::pool::init_with_path(":memory:")` 拿内存连接池，
//! 再调用各 `db::*` 模块的纯函数验证 SQL 行为。

use little_ice_lib::db::{chat, favorite, message, pool, settings};
use little_ice_lib::models::MessageRole;

async fn fresh_pool() -> pool::DbPool {
    pool::init_with_path(std::path::Path::new(":memory:"))
        .await
        .expect("memory db init")
}

/// 等待跨过至少 1 个毫秒（避免 UUIDv7 timestamp 碰撞导致随机位主导排序）
async fn sleep_one_ms() {
    tokio::time::sleep(std::time::Duration::from_millis(2)).await;
}

// ===== Chat =====

#[tokio::test]
async fn chat_crud_roundtrip() {
    let pool = fresh_pool().await;

    // create
    let c = chat::create(&pool, "hello".into()).await.unwrap();
    assert_eq!(c.title, "hello");
    assert!(!c.id.is_empty());
    assert!(i64::from(c.created_at) > 0);
    assert_eq!(c.created_at, c.updated_at);

    // list_all (倒序)
    let list = chat::list_all(&pool).await.unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, c.id);

    // get
    let got = chat::get(&pool, &c.id).await.unwrap();
    assert_eq!(got.title, "hello");

    // rename (会刷新 updated_at)
    sleep_one_ms().await;
    let renamed = chat::rename(&pool, &c.id, "world".into()).await.unwrap();
    assert_eq!(renamed.title, "world");
    assert!(i64::from(renamed.updated_at) > i64::from(c.updated_at));

    // delete
    chat::delete(&pool, &c.id).await.unwrap();
    let after = chat::list_all(&pool).await.unwrap();
    assert!(after.is_empty());
}

#[tokio::test]
async fn chat_get_not_found_returns_error() {
    let pool = fresh_pool().await;
    let err = chat::get(&pool, "no-such-id").await.unwrap_err();
    assert!(matches!(err, little_ice_lib::error::AppError::NotFound(_)));
}

#[tokio::test]
async fn chat_touch_bumps_updated_at() {
    let pool = fresh_pool().await;
    let c = chat::create(&pool, "x".into()).await.unwrap();
    sleep_one_ms().await;
    chat::touch(&pool, &c.id).await.unwrap();
    let after = chat::get(&pool, &c.id).await.unwrap();
    assert!(i64::from(after.updated_at) > i64::from(c.updated_at));
}

#[tokio::test]
async fn chat_list_orders_by_updated_at_desc() {
    let pool = fresh_pool().await;
    let c1 = chat::create(&pool, "first".into()).await.unwrap();
    sleep_one_ms().await;
    let c2 = chat::create(&pool, "second".into()).await.unwrap();
    sleep_one_ms().await;
    let c3 = chat::create(&pool, "third".into()).await.unwrap();

    let list = chat::list_all(&pool).await.unwrap();
    assert_eq!(list.len(), 3);
    // 倒序：最近更新的（c3）排最前
    assert_eq!(list[0].id, c3.id);
    assert_eq!(list[1].id, c2.id);
    assert_eq!(list[2].id, c1.id);
}

// ===== Message =====

#[tokio::test]
async fn message_crud_with_role_roundtrip() {
    let pool = fresh_pool().await;
    let c = chat::create(&pool, "ch".into()).await.unwrap();

    let m1 = message::create(&pool, &c.id, MessageRole::User, "hi".into())
        .await
        .unwrap();
    sleep_one_ms().await;
    let m2 = message::create(&pool, &c.id, MessageRole::Assistant, "hello!".into())
        .await
        .unwrap();
    sleep_one_ms().await;
    let m3 = message::create(&pool, &c.id, MessageRole::System, "sys".into())
        .await
        .unwrap();

    // 列表按 id 升序；UUIDv7 跨毫秒时 id 字典序 ≈ 时间序
    let list = message::list_by_chat(&pool, &c.id).await.unwrap();
    assert_eq!(list.len(), 3);
    assert_eq!(list[0].id, m1.id);
    assert_eq!(list[1].id, m2.id);
    assert_eq!(list[2].id, m3.id);

    // role 持久化后再读出仍是原枚举
    assert!(matches!(list[0].role, MessageRole::User));
    assert!(matches!(list[1].role, MessageRole::Assistant));
    assert!(matches!(list[2].role, MessageRole::System));

    // 流式场景：update_content 覆盖 content
    message::update_content(&pool, &m2.id, "hello world")
        .await
        .unwrap();
    let list2 = message::list_by_chat(&pool, &c.id).await.unwrap();
    let m2_after = list2.iter().find(|m| m.id == m2.id).unwrap();
    assert_eq!(m2_after.content, "hello world");
}

#[tokio::test]
async fn messages_are_isolated_per_chat() {
    let pool = fresh_pool().await;
    let c1 = chat::create(&pool, "c1".into()).await.unwrap();
    sleep_one_ms().await;
    let c2 = chat::create(&pool, "c2".into()).await.unwrap();

    message::create(&pool, &c1.id, MessageRole::User, "a".into())
        .await
        .unwrap();
    message::create(&pool, &c2.id, MessageRole::User, "b".into())
        .await
        .unwrap();

    assert_eq!(message::list_by_chat(&pool, &c1.id).await.unwrap().len(), 1);
    assert_eq!(message::list_by_chat(&pool, &c2.id).await.unwrap().len(), 1);
}

#[tokio::test]
async fn message_role_protocol_str() {
    assert_eq!(MessageRole::User.as_protocol_str(), "user");
    assert_eq!(MessageRole::Assistant.as_protocol_str(), "assistant");
    assert_eq!(MessageRole::System.as_protocol_str(), "system");
}

#[tokio::test]
async fn message_id_is_time_ordered_across_milliseconds() {
    let pool = fresh_pool().await;
    let c = chat::create(&pool, "ch".into()).await.unwrap();

    let m1 = message::create(&pool, &c.id, MessageRole::User, "a".into())
        .await
        .unwrap();
    sleep_one_ms().await;
    let m2 = message::create(&pool, &c.id, MessageRole::User, "b".into())
        .await
        .unwrap();
    sleep_one_ms().await;
    let m3 = message::create(&pool, &c.id, MessageRole::User, "c".into())
        .await
        .unwrap();

    // 跨毫秒：UUIDv7 字符串字典序 ≈ 时间顺序
    assert!(m1.id < m2.id, "m1.id ({}) < m2.id ({})", m1.id, m2.id);
    assert!(m2.id < m3.id, "m2.id ({}) < m3.id ({})", m2.id, m3.id);
}

// ===== Favorite =====

#[tokio::test]
async fn favorite_crud_with_patch_roundtrip() {
    let pool = fresh_pool().await;

    // 手动创建（无 source_chat_id）
    let f1 = favorite::create(&pool, "title1".into(), "body1".into(), None, None)
        .await
        .unwrap();
    assert!(f1.source_chat_id.is_none());

    // 从 chat 收藏（有 source_chat_id）
    let c = chat::create(&pool, "ch".into()).await.unwrap();
    sleep_one_ms().await;
    let f2 = favorite::create(
        &pool,
        "from-chat".into(),
        "x".into(),
        Some(c.id.clone()),
        None,
    )
    .await
    .unwrap();
    assert_eq!(f2.source_chat_id.as_deref(), Some(c.id.as_str()));

    // list_all 倒序（updated_at DESC）：f2 在前
    let list = favorite::list_all(&pool).await.unwrap();
    assert_eq!(list.len(), 2);
    assert_eq!(list[0].id, f2.id);
    assert_eq!(list[1].id, f1.id);

    // patch 仅改 title
    sleep_one_ms().await;
    let patched = favorite::update(
        &pool,
        &f1.id,
        favorite::FavoritePatch {
            title: Some("renamed".into()),
            content: None,
        },
    )
    .await
    .unwrap();
    assert_eq!(patched.title, "renamed");
    assert_eq!(patched.content, "body1"); // 没传 content，保持原值
    assert!(i64::from(patched.updated_at) > i64::from(f1.updated_at));

    // patch 仅改 content
    sleep_one_ms().await;
    let patched2 = favorite::update(
        &pool,
        &f1.id,
        favorite::FavoritePatch {
            title: None,
            content: Some("new body".into()),
        },
    )
    .await
    .unwrap();
    assert_eq!(patched2.title, "renamed");
    assert_eq!(patched2.content, "new body");
    assert!(i64::from(patched2.updated_at) > i64::from(patched.updated_at));

    // delete
    favorite::delete(&pool, &f1.id).await.unwrap();
    let list = favorite::list_all(&pool).await.unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, f2.id);
}

#[tokio::test]
async fn favorite_count_by_chat_filters_correctly() {
    let pool = fresh_pool().await;
    let c1 = chat::create(&pool, "c1".into()).await.unwrap();
    sleep_one_ms().await;
    let c2 = chat::create(&pool, "c2".into()).await.unwrap();

    // c1: 3 个收藏
    for i in 0..3 {
        favorite::create(
            &pool,
            format!("c1-fav-{i}"),
            "x".into(),
            Some(c1.id.clone()),
            None,
        )
        .await
        .unwrap();
    }
    // c2: 1 个收藏
    favorite::create(
        &pool,
        "c2-fav".into(),
        "x".into(),
        Some(c2.id.clone()),
        None,
    )
    .await
    .unwrap();
    // 手动创建（无 source）：不计入任何 chat
    favorite::create(&pool, "manual".into(), "x".into(), None, None)
        .await
        .unwrap();

    assert_eq!(favorite::count_by_chat(&pool, &c1.id).await.unwrap(), 3);
    assert_eq!(favorite::count_by_chat(&pool, &c2.id).await.unwrap(), 1);
    assert_eq!(favorite::count_by_chat(&pool, "no-such").await.unwrap(), 0);
}

#[tokio::test]
async fn favorite_get_not_found_returns_error() {
    let pool = fresh_pool().await;
    let err = favorite::get(&pool, "no-such-id").await.unwrap_err();
    assert!(matches!(err, little_ice_lib::error::AppError::NotFound(_)));
}

// ===== Settings =====

#[tokio::test]
async fn settings_kv_roundtrip() {
    let pool = fresh_pool().await;

    // 初始行
    let api = settings::get(&pool, "deepseek_api_key").await.unwrap();
    assert_eq!(api, Some(String::new()));

    // set
    settings::set(&pool, "deepseek_api_key", "sk-1234")
        .await
        .unwrap();
    assert_eq!(
        settings::get(&pool, "deepseek_api_key").await.unwrap(),
        Some("sk-1234".to_string())
    );

    // 覆盖
    settings::set(&pool, "deepseek_api_key", "sk-5678")
        .await
        .unwrap();
    assert_eq!(
        settings::get(&pool, "deepseek_api_key").await.unwrap(),
        Some("sk-5678".to_string())
    );

    // 写空字符串（前端视为清除）
    settings::set(&pool, "deepseek_api_key", "").await.unwrap();
    assert_eq!(
        settings::get(&pool, "deepseek_api_key").await.unwrap(),
        Some(String::new())
    );

    // 未知 key 返回 None
    assert!(settings::get(&pool, "no-such").await.unwrap().is_none());

    // 新增自定义 key
    settings::set(&pool, "ui.theme", "dark").await.unwrap();
    assert_eq!(
        settings::get(&pool, "ui.theme").await.unwrap(),
        Some("dark".to_string())
    );
}
