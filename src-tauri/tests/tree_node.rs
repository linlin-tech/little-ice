//! 集成测试：tree_nodes 表 CRUD + 递归删除 + 与 chats/messages 一致性

use little_ice_lib::db::{chat, message, pool, tree_node};
use little_ice_lib::models::MessageRole;

async fn fresh_pool() -> pool::DbPool {
    pool::init_with_path(std::path::Path::new(":memory:"))
        .await
        .expect("memory db init")
}

#[tokio::test]
async fn create_root_node_syncs_to_chats() {
    let pool = fresh_pool().await;

    // 创建根节点
    let node = tree_node::create(&pool, "话题A".into(), None, None)
        .await
        .unwrap();
    assert_eq!(node.title, "话题A");
    assert!(node.parent_id.is_none());
    assert_eq!(node.order, 0);

    // 应同时在 chats 表存在（保持 messages 外键完整）
    let chat = chat::get(&pool, &node.id).await.unwrap();
    assert_eq!(chat.title, "话题A");

    // list_roots 应返回该节点，childCount = 0
    let roots = tree_node::list_roots(&pool).await.unwrap();
    assert_eq!(roots.len(), 1);
    assert_eq!(roots[0].id, node.id);
    assert_eq!(roots[0].child_count, 0);
}

#[tokio::test]
async fn create_child_node_increments_child_count() {
    let pool = fresh_pool().await;

    let root = tree_node::create(&pool, "root".into(), None, None)
        .await
        .unwrap();
    let child1 = tree_node::create(&pool, "child1".into(), Some(root.id.clone()), None)
        .await
        .unwrap();
    let child2 = tree_node::create(&pool, "child2".into(), Some(root.id.clone()), None)
        .await
        .unwrap();

    assert_eq!(child1.parent_id.as_deref(), Some(root.id.as_str()));
    assert_eq!(child1.order, 0);
    assert_eq!(child2.order, 1);

    // root 的 childCount 应为 2
    let root_after = tree_node::get(&pool, &root.id).await.unwrap();
    assert_eq!(root_after.child_count, 2);

    // list_children 按 order 排序
    let children = tree_node::list_children(&pool, &root.id).await.unwrap();
    assert_eq!(children.len(), 2);
    assert_eq!(children[0].id, child1.id);
    assert_eq!(children[1].id, child2.id);
}

#[tokio::test]
async fn rename_node_syncs_to_chats() {
    let pool = fresh_pool().await;

    let node = tree_node::create(&pool, "old".into(), None, None)
        .await
        .unwrap();
    tree_node::rename(&pool, &node.id, "new".into())
        .await
        .unwrap();

    // tree_nodes 已更新
    let tn = tree_node::get(&pool, &node.id).await.unwrap();
    assert_eq!(tn.title, "new");

    // chats 同步更新
    let ch = chat::get(&pool, &node.id).await.unwrap();
    assert_eq!(ch.title, "new");
}

#[tokio::test]
async fn delete_recursive_removes_subtree_and_messages() {
    let pool = fresh_pool().await;

    // 构建树：root -> child -> grandchild
    let root = tree_node::create(&pool, "root".into(), None, None)
        .await
        .unwrap();
    let child = tree_node::create(&pool, "child".into(), Some(root.id.clone()), None)
        .await
        .unwrap();
    let grandchild =
        tree_node::create(&pool, "gc".into(), Some(child.id.clone()), None)
            .await
            .unwrap();

    // 在 child 节点下创建 message（chat_id = child.id，chats 表有对应记录）
    message::create(&pool, &child.id, MessageRole::User, "hi".into())
        .await
        .unwrap();

    // 删除 root（递归删除整棵树）
    tree_node::delete_recursive(&pool, &root.id).await.unwrap();

    // tree_nodes: root/child/grandchild 全部删除
    assert!(tree_node::get(&pool, &root.id).await.is_err());
    assert!(tree_node::get(&pool, &child.id).await.is_err());
    assert!(tree_node::get(&pool, &grandchild.id).await.is_err());

    // chats: 对应记录删除
    assert!(chat::get(&pool, &root.id).await.is_err());
    assert!(chat::get(&pool, &child.id).await.is_err());

    // messages: 关联消息删除
    assert_eq!(message::list_by_chat(&pool, &child.id).await.unwrap().len(), 0);

    // list_roots 为空
    assert!(tree_node::list_roots(&pool).await.unwrap().is_empty());
}

#[tokio::test]
async fn delete_child_keeps_siblings() {
    let pool = fresh_pool().await;

    let root = tree_node::create(&pool, "root".into(), None, None)
        .await
        .unwrap();
    let c1 = tree_node::create(&pool, "c1".into(), Some(root.id.clone()), None)
        .await
        .unwrap();
    let _c2 = tree_node::create(&pool, "c2".into(), Some(root.id.clone()), None)
        .await
        .unwrap();

    // 删除 c1
    tree_node::delete_recursive(&pool, &c1.id).await.unwrap();

    // c2 和 root 仍在
    assert!(tree_node::get(&pool, &root.id).await.is_ok());
    assert!(tree_node::get(&pool, &_c2.id).await.is_ok());
    assert!(tree_node::get(&pool, &c1.id).await.is_err());

    // root childCount 降为 1
    let root_after = tree_node::get(&pool, &root.id).await.unwrap();
    assert_eq!(root_after.child_count, 1);
}

#[tokio::test]
async fn move_node_changes_parent() {
    let pool = fresh_pool().await;

    let root = tree_node::create(&pool, "root".into(), None, None)
        .await
        .unwrap();
    let child = tree_node::create(&pool, "child".into(), Some(root.id.clone()), None)
        .await
        .unwrap();

    // 移到根级（parent_id = NULL）
    let moved = tree_node::move_node(&pool, &child.id, None, 0)
        .await
        .unwrap();
    assert!(moved.parent_id.is_none());

    // 现在 list_roots 应有 2 个
    let roots = tree_node::list_roots(&pool).await.unwrap();
    assert_eq!(roots.len(), 2);
}
