-- ===== 思维树图功能：新增 tree_nodes 表 =====
--
-- 设计原则（参见 docs/思维树图功能设计.md）：
-- 1. tree_nodes.id 与原有 chats.id 一致（保持 messages.chat_id 关联正常）
-- 2. 保留 chats 表不删除（避免破坏现有代码），tree_nodes 作为新的数据源
-- 3. 所有原有 chats 数据迁移为根节点（parent_id = NULL）
-- 4. role_id 不可为空，默认绑定「默认助手」（与 chats.role_id 对齐）
--
-- 注意：本迁移不会删除 chats 表，也不修改 messages 表的外键。
-- tree_nodes 与 chats 通过相同的 id 共存，messages.chat_id 同时关联两者。

CREATE TABLE IF NOT EXISTS tree_nodes (
  id          TEXT PRIMARY KEY NOT NULL,    -- 与 chats.id 一致
  title       TEXT NOT NULL,                -- 节点标题（对应 chats.title）
  parent_id   TEXT DEFAULT NULL,            -- 父节点 id；NULL 表示根节点
  "order"     INTEGER NOT NULL DEFAULT 0,   -- 同级排序序号
  role_id     TEXT NOT NULL,                -- 关联的模型角色 id（不可为空）
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES tree_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_tree_nodes_parent_id ON tree_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_tree_nodes_updated_at ON tree_nodes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tree_nodes_role_id ON tree_nodes(role_id);

-- 迁移 chats 表数据到 tree_nodes（幂等：仅插入尚不存在的记录）
-- 所有原有对话成为根节点（parent_id = NULL），保持 id 不变
INSERT OR IGNORE INTO tree_nodes (id, title, parent_id, "order", role_id, created_at, updated_at)
SELECT
  id,
  title AS title,
  NULL AS parent_id,
  0 AS "order",
  role_id AS role_id,
  created_at,
  updated_at
FROM chats;