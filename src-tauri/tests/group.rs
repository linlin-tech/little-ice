//! 集成测试：分组管理 CRUD

use little_ice_lib::db::{chat, favorite, group, pool, role};
use little_ice_lib::models::ResourceType;

async fn fresh_pool() -> pool::DbPool {
    pool::init_with_path(std::path::Path::new(":memory:"))
        .await
        .expect("memory db init")
}

#[tokio::test]
async fn group_crud_roundtrip() {
    let pool = fresh_pool().await;

    // create
    let g = group::create(&pool, ResourceType::Chat, "工作".into())
        .await
        .unwrap();
    assert_eq!(g.name, "工作");
    assert_eq!(g.resource_type, ResourceType::Chat);

    // list
    let list = group::list(&pool, ResourceType::Chat).await.unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, g.id);

    // rename
    let renamed = group::rename(&pool, &g.id, "工作相关".into()).await.unwrap();
    assert_eq!(renamed.name, "工作相关");

    // delete
    group::delete(&pool, &g.id).await.unwrap();
    let list_after = group::list(&pool, ResourceType::Chat).await.unwrap();
    assert!(list_after.is_empty());
}

#[tokio::test]
async fn group_name_unique_per_resource_type() {
    let pool = fresh_pool().await;

    group::create(&pool, ResourceType::Chat, "同名".into())
        .await
        .unwrap();
    // 不同资源类型可同名
    group::create(&pool, ResourceType::Favorite, "同名".into())
        .await
        .unwrap();

    // 同资源类型不可同名
    let err = group::create(&pool, ResourceType::Chat, "同名".into())
        .await
        .unwrap_err();
    assert!(
        matches!(err, little_ice_lib::error::AppError::Database(_)),
        "expected database unique constraint error, got {:?}",
        err
    );
}

#[tokio::test]
async fn move_chat_to_group_and_out() {
    let pool = fresh_pool().await;

    let chat = chat::create(&pool, "话题".into()).await.unwrap();
    let g = group::create(&pool, ResourceType::Chat, "工作".into())
        .await
        .unwrap();

    assert!(chat.group_id.is_none());

    // move in
    group::move_item(&pool, ResourceType::Chat, &chat.id, Some(g.id.clone()))
        .await
        .unwrap();
    let chat_after = chat::get(&pool, &chat.id).await.unwrap();
    assert_eq!(chat_after.group_id.as_deref(), Some(g.id.as_str()));

    // move out
    group::move_item(&pool, ResourceType::Chat, &chat.id, None)
        .await
        .unwrap();
    let chat_out = chat::get(&pool, &chat.id).await.unwrap();
    assert!(chat_out.group_id.is_none());
}

#[tokio::test]
async fn delete_group_deletes_items() {
    let pool = fresh_pool().await;

    let chat = chat::create(&pool, "话题".into()).await.unwrap();
    let g = group::create(&pool, ResourceType::Chat, "工作".into())
        .await
        .unwrap();
    group::move_item(&pool, ResourceType::Chat, &chat.id, Some(g.id.clone()))
        .await
        .unwrap();

    group::delete(&pool, &g.id).await.unwrap();

    // 分组内的对话应被级联删除
    assert!(chat::get(&pool, &chat.id).await.is_err());
}

#[tokio::test]
async fn delete_group_deletes_favorites() {
    let pool = fresh_pool().await;

    let fav = favorite::create(&pool, "收藏".into(), "内容".into(), None, None)
        .await
        .unwrap();
    let g = group::create(&pool, ResourceType::Favorite, "工作".into())
        .await
        .unwrap();
    group::move_item(&pool, ResourceType::Favorite, &fav.id, Some(g.id.clone()))
        .await
        .unwrap();

    group::delete(&pool, &g.id).await.unwrap();

    assert!(favorite::get(&pool, &fav.id).await.is_err());
}

#[tokio::test]
async fn group_types_are_isolated() {
    let pool = fresh_pool().await;

    let g_chat = group::create(&pool, ResourceType::Chat, "C".into())
        .await
        .unwrap();
    let _g_fav = group::create(&pool, ResourceType::Favorite, "F".into())
        .await
        .unwrap();
    let g_role = group::create(&pool, ResourceType::Role, "R".into())
        .await
        .unwrap();

    assert_eq!(group::list(&pool, ResourceType::Chat).await.unwrap().len(), 1);
    assert_eq!(
        group::list(&pool, ResourceType::Favorite)
            .await
            .unwrap()
            .len(),
        1
    );
    assert_eq!(group::list(&pool, ResourceType::Role).await.unwrap().len(), 1);

    // 不能把 favorite 移到 chat 分组
    let fav = favorite::create(&pool, "t".into(), "c".into(), None, None)
        .await
        .unwrap();
    let err = group::move_item(
        &pool,
        ResourceType::Favorite,
        &fav.id,
        Some(g_chat.id.clone()),
    )
    .await
    .unwrap_err();
    assert!(
        matches!(err, little_ice_lib::error::AppError::Validation(_)),
        "expected validation error, got {:?}",
        err
    );

    // role 可以移到 role 分组
    let r = role::create(&pool, "测试角色".into(), "职责".into()).await.unwrap();
    group::move_item(&pool, ResourceType::Role, &r.id, Some(g_role.id.clone()))
        .await
        .unwrap();
    let r_after = role::get(&pool, &r.id).await.unwrap();
    assert_eq!(r_after.group_id.as_deref(), Some(g_role.id.as_str()));
}
