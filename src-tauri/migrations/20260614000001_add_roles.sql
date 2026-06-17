-- ===== Model Roles =====
-- 新增 roles 表，支持 chat.roleId 外键

CREATE TABLE IF NOT EXISTS roles (
  id              TEXT PRIMARY KEY NOT NULL,
  name            TEXT NOT NULL UNIQUE,
  responsibility  TEXT NOT NULL,
  is_builtin      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_roles_updated_at ON roles(updated_at DESC);

-- ===== 先插入系统内置角色，确保 chats 迁移时有合法 role_id =====
INSERT OR IGNORE INTO roles (id, name, responsibility, is_builtin, created_at, updated_at)
VALUES (
  'role_default_assistant',
  '默认助手',
  '你是一个乐于助人、知识渊博的 AI 助手。请用清晰、准确、简洁的中文回答用户的问题。',
  1,
  0,
  0
);

-- ===== Chats：新增 role_id =====
-- SQLite 旧版本ALTER TABLE能力有限，使用临时表迁移
CREATE TABLE IF NOT EXISTS chats_new (
  id          TEXT PRIMARY KEY NOT NULL,
  title       TEXT NOT NULL,
  role_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats_new(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_role_id ON chats_new(role_id);

-- 复制旧数据，role_id 默认绑定「默认助手」
INSERT INTO chats_new (id, title, role_id, created_at, updated_at)
SELECT id, title, 'role_default_assistant', created_at, updated_at
FROM chats;

DROP TABLE chats;
ALTER TABLE chats_new RENAME TO chats;

-- ===== Settings (key-value) =====
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
