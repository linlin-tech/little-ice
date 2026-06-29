-- ===== 分组管理功能：新增 groups 表与 resource.group_id =====
--
-- 设计原则（参见 docs/分组管理.md）：
-- 1. 一个 groups 表统一管理对话(chat)、收藏(favorite)、模型角色(role)三种资源的分组
-- 2. group_id 为 NULL 表示未分组；删除分组时条目自动回到未分组
-- 3. 不删除已有表与数据，仅新增列与索引

-- ===== 分组表 =====
CREATE TABLE IF NOT EXISTS groups (
  id            TEXT PRIMARY KEY NOT NULL,
  resource_type TEXT NOT NULL CHECK(resource_type IN ('chat', 'favorite', 'role')),
  name          TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  UNIQUE(resource_type, name)
);

CREATE INDEX IF NOT EXISTS idx_groups_resource_type ON groups(resource_type);
CREATE INDEX IF NOT EXISTS idx_groups_sort_order ON groups(resource_type, sort_order);

-- ===== 为现有资源表新增 group_id（nullable = 未分组） =====
ALTER TABLE chats ADD COLUMN group_id TEXT REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE favorites ADD COLUMN group_id TEXT REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE roles ADD COLUMN group_id TEXT REFERENCES groups(id) ON DELETE SET NULL;

-- 分组查询索引
CREATE INDEX IF NOT EXISTS idx_chats_group_id ON chats(group_id);
CREATE INDEX IF NOT EXISTS idx_favorites_group_id ON favorites(group_id);
CREATE INDEX IF NOT EXISTS idx_roles_group_id ON roles(group_id);
