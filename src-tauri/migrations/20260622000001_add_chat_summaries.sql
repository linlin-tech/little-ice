-- 创建 chat_summaries 表：按 113 原则存储对话摘要
-- 113 原则：1 个最近摘要 + 1 轮最近对话 + 每 3 轮触发一次摘要
CREATE TABLE IF NOT EXISTS chat_summaries (
    id TEXT PRIMARY KEY NOT NULL,
    chat_id TEXT NOT NULL,
    content TEXT NOT NULL,              -- 摘要内容，已截断至 300 字
    keywords TEXT NOT NULL DEFAULT '[]', -- 3-5 个关键词，存储为 JSON 数组字符串
    last_message_id TEXT NOT NULL,      -- 摘要覆盖的最后一个 message ID
    created_at INTEGER NOT NULL,

    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- 加速按对话查询最新摘要
CREATE INDEX IF NOT EXISTS idx_chat_summaries_chat_id ON chat_summaries(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_last_message_id ON chat_summaries(last_message_id);
