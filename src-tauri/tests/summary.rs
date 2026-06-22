//! 集成测试：113 原则摘要服务
//!
//! 不依赖真实 AI 接口，通过手动构造消息来验证：
//! - 触发条件
//! - 摘要 CRUD
//! - 上下文构建

use little_ice_lib::db::{chat, message, pool, summary};
use little_ice_lib::models::{MessageRole, SummaryContext};

async fn fresh_pool() -> pool::DbPool {
    pool::init_with_path(std::path::Path::new(":memory:"))
        .await
        .expect("memory db init")
}

/// 等待跨过至少 1 个毫秒（避免 UUIDv7 timestamp 碰撞）
async fn sleep_one_ms() {
    tokio::time::sleep(std::time::Duration::from_millis(2)).await;
}

#[tokio::test]
async fn summary_crud_roundtrip() {
    let pool = fresh_pool().await;
    let c = chat::create(&pool, "summary-test".into()).await.unwrap();

    let s = little_ice_lib::models::ChatSummary {
        id: "sum-1".into(),
        chat_id: c.id.clone(),
        content: "这是一个摘要".into(),
        keywords: sqlx::types::Json(vec!["关键词1".into(), "关键词2".into()]),
        last_message_id: "msg-last".into(),
        created_at: little_ice_lib::models::UnixMs::now(),
    };

    summary::replace_for_chat(&pool, &c.id, &s).await.unwrap();

    let got = summary::find_latest_by_chat(&pool, &c.id).await.unwrap();
    assert!(got.is_some());
    let got = got.unwrap();
    assert_eq!(got.id, "sum-1");
    assert_eq!(got.content, "这是一个摘要");
    assert_eq!(got.keywords.0, vec!["关键词1", "关键词2"]);
    assert_eq!(got.last_message_id, "msg-last");

    // 333 原则：最多保留 3 条最新摘要
    for i in 2..=4 {
        sleep_one_ms().await;
        let s = little_ice_lib::models::ChatSummary {
            id: format!("sum-{i}"),
            chat_id: c.id.clone(),
            content: format!("第{i}个摘要"),
            keywords: sqlx::types::Json(vec![format!("关键词{i}")]),
            last_message_id: format!("msg-last{i}"),
            created_at: little_ice_lib::models::UnixMs::now(),
        };
        summary::replace_for_chat(&pool, &c.id, &s).await.unwrap();
    }

    let all = sqlx::query_as::<_, little_ice_lib::models::ChatSummary>(
        "SELECT id, chat_id, content, keywords, last_message_id, created_at FROM chat_summaries WHERE chat_id = ? ORDER BY created_at ASC",
    )
    .bind(&c.id)
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(all.len(), 3);
    assert_eq!(all[0].id, "sum-2");
    assert_eq!(all[1].id, "sum-3");
    assert_eq!(all[2].id, "sum-4");
}

#[tokio::test]
async fn summary_list_recent_by_chat() {
    let pool = fresh_pool().await;
    let c = chat::create(&pool, "list-recent".into()).await.unwrap();

    for i in 1..=5 {
        sleep_one_ms().await;
        let s = little_ice_lib::models::ChatSummary {
            id: format!("sum-{i}"),
            chat_id: c.id.clone(),
            content: format!("摘要{i}"),
            keywords: sqlx::types::Json(vec![]),
            last_message_id: format!("msg-{i}"),
            created_at: little_ice_lib::models::UnixMs::now(),
        };
        summary::replace_for_chat(&pool, &c.id, &s).await.unwrap();
    }

    // 最多保留 3 条，且按时间正序返回
    let recent = summary::list_recent_by_chat(&pool, &c.id, 3).await.unwrap();
    assert_eq!(recent.len(), 3);
    assert_eq!(recent[0].id, "sum-3");
    assert_eq!(recent[1].id, "sum-4");
    assert_eq!(recent[2].id, "sum-5");
}

#[tokio::test]
async fn summary_isolated_per_chat() {
    let pool = fresh_pool().await;
    let c1 = chat::create(&pool, "c1".into()).await.unwrap();
    sleep_one_ms().await;
    let c2 = chat::create(&pool, "c2".into()).await.unwrap();

    let s = little_ice_lib::models::ChatSummary {
        id: "sum-c1".into(),
        chat_id: c1.id.clone(),
        content: "c1 摘要".into(),
        keywords: sqlx::types::Json(vec![]),
        last_message_id: "msg-c1".into(),
        created_at: little_ice_lib::models::UnixMs::now(),
    };
    summary::replace_for_chat(&pool, &c1.id, &s).await.unwrap();

    assert!(
        summary::find_latest_by_chat(&pool, &c1.id)
            .await
            .unwrap()
            .is_some()
    );
    assert!(
        summary::find_latest_by_chat(&pool, &c2.id)
            .await
            .unwrap()
            .is_none()
    );
}

#[tokio::test]
async fn message_count_user_messages() {
    let pool = fresh_pool().await;
    let c = chat::create(&pool, "count".into()).await.unwrap();

    assert_eq!(message::count_user_messages(&pool, &c.id).await.unwrap(), 0);

    message::create(&pool, &c.id, MessageRole::User, "u1".into())
        .await
        .unwrap();
    assert_eq!(message::count_user_messages(&pool, &c.id).await.unwrap(), 1);

    message::create(&pool, &c.id, MessageRole::Assistant, "a1".into())
        .await
        .unwrap();
    assert_eq!(message::count_user_messages(&pool, &c.id).await.unwrap(), 1);

    message::create(&pool, &c.id, MessageRole::User, "u2".into())
        .await
        .unwrap();
    assert_eq!(message::count_user_messages(&pool, &c.id).await.unwrap(), 2);
}

#[tokio::test]
async fn message_count_user_messages_up_to_id() {
    let pool = fresh_pool().await;
    let c = chat::create(&pool, "count-up-to".into()).await.unwrap();

    let u1 = message::create(&pool, &c.id, MessageRole::User, "u1".into())
        .await
        .unwrap();
    sleep_one_ms().await;
    let a1 = message::create(&pool, &c.id, MessageRole::Assistant, "a1".into())
        .await
        .unwrap();
    sleep_one_ms().await;
    let u2 = message::create(&pool, &c.id, MessageRole::User, "u2".into())
        .await
        .unwrap();

    assert_eq!(
        message::count_user_messages_up_to_id(&pool, &c.id, &u1.id)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        message::count_user_messages_up_to_id(&pool, &c.id, &a1.id)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        message::count_user_messages_up_to_id(&pool, &c.id, &u2.id)
            .await
            .unwrap(),
        2
    );
}

#[tokio::test]
async fn message_list_recent_complete_rounds_before() {
    let pool = fresh_pool().await;
    let c = chat::create(&pool, "rounds".into()).await.unwrap();

    // round 1
    let u1 = message::create(&pool, &c.id, MessageRole::User, "u1".into())
        .await
        .unwrap();
    sleep_one_ms().await;
    let a1 = message::create(&pool, &c.id, MessageRole::Assistant, "a1".into())
        .await
        .unwrap();
    sleep_one_ms().await;
    // round 2
    let u2 = message::create(&pool, &c.id, MessageRole::User, "u2".into())
        .await
        .unwrap();
    sleep_one_ms().await;
    let a2 = message::create(&pool, &c.id, MessageRole::Assistant, "a2".into())
        .await
        .unwrap();
    sleep_one_ms().await;
    // round 3 当前 user 问题
    let u3 = message::create(&pool, &c.id, MessageRole::User, "u3".into())
        .await
        .unwrap();

    let recent = message::list_recent_complete_rounds_before(&pool, &c.id, &u3.id, 3)
        .await
        .unwrap();
    assert_eq!(recent.len(), 4);
    assert_eq!(recent[0].id, u1.id);
    assert_eq!(recent[1].id, a1.id);
    assert_eq!(recent[2].id, u2.id);
    assert_eq!(recent[3].id, a2.id);
}

#[tokio::test]
async fn summary_context_default_is_empty() {
    let ctx = SummaryContext::default();
    assert!(ctx.summary.is_none());
    assert!(ctx.keywords.is_none());
    assert!(ctx.last_message_id.is_none());
}
