-- ===== Chats =====
CREATE TABLE IF NOT EXISTS chats (
  id          TEXT PRIMARY KEY NOT NULL,
  title       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);

-- ===== Messages =====
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY NOT NULL,    -- UUIDv7，时间有序
  chat_id     TEXT NOT NULL,
  role        TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,             -- 保留用于显示（"14:23"），但不再用于排序
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);
-- V1.1 简化：UUIDv7 的 id 已时间有序，排序走 id 即可，只需 chat_id 索引
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);

-- ===== Favorites =====
CREATE TABLE IF NOT EXISTS favorites (
  id              TEXT PRIMARY KEY NOT NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  source_chat_id  TEXT,                 -- 允许为 NULL（手动创建）
  source_message_id TEXT,               -- 来源 Message id；允许为 NULL（手动创建）
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY (source_chat_id) REFERENCES chats(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_favorites_updated_at ON favorites(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_source_chat_id ON favorites(source_chat_id);
CREATE INDEX IF NOT EXISTS idx_favorites_source_message_id ON favorites(source_message_id);

-- ===== Settings (key-value) =====
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

-- 初始 settings 行
INSERT OR IGNORE INTO settings (key, value) VALUES ('deepseek_api_key', '');
