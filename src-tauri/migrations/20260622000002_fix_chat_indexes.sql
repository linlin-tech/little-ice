-- 修复 20260614000001_add_roles 迁移中临时表重命名导致的索引丢失问题。
--
-- 原迁移在 `chats_new` 上使用了 `CREATE INDEX IF NOT EXISTS`，
-- 但旧 `chats` 表已存在同名索引，导致 sqlx 跳过创建；
-- 随后旧表被 DROP，索引一同消失，`ALTER TABLE ... RENAME` 后新表缺少索引。
-- 本迁移显式在最终 `chats` 表上补建索引。
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_role_id ON chats(role_id);
