/**
 * Tauri 命令包装（类型安全 invoke）
 *
 * 所有命令签名与后端 §4 / §6 严格 1:1 对齐；返回类型用 `AppResult<T>` 失败抛
 * `string` 错误（`AppError` 的 `Serialize as String` 实现）。
 *
 * 用法：
 * ```ts
 * import { tauri } from "@/lib/tauri";
 * const chats = await tauri.listChats();   // Chat[]
 * const chat = await tauri.getChat(id);     // Chat
 * ```
 *
 * 后续 feature 会在 `features/<name>/api.ts` 中再次语义化包装一次
 * （如 `chatApi.sendMessage(chatId, content)`），这里只做最薄的 1:1 映射。
 *
 * 类型由 `src/types/generated.ts`（specta 自动生成）提供，**不要**在此文件
 * 重新声明 model 类型。
 */

import { invoke } from "@tauri-apps/api/core";

import type {
  Chat,
  Favorite,
  FavoritePatch,
  Message,
  Role,
  SendMessageResult,
  Settings,
} from "@/types/models";

// =============================================================
// Chat（§4.1）
// =============================================================

/** `create_chat({ title }) -> Chat` */
function createChat(title: string): Promise<Chat> {
  return invoke<Chat>("create_chat", { title });
}

/** `list_chats({}) -> Chat[]` */
function listChats(): Promise<Chat[]> {
  return invoke<Chat[]>("list_chats");
}

/** `get_chat({ id }) -> Chat` */
function getChat(id: string): Promise<Chat> {
  return invoke<Chat>("get_chat", { id });
}

/** `rename_chat({ id, title }) -> Chat` */
function renameChat(id: string, title: string): Promise<Chat> {
  return invoke<Chat>("rename_chat", { id, title });
}

/** `set_chat_role({ id, roleId }) -> Chat` */
function setChatRole(id: string, roleId: string): Promise<Chat> {
  return invoke<Chat>("set_chat_role", { id, roleId });
}

/** `delete_chat({ id }) -> void` */
function deleteChat(id: string): Promise<void> {
  return invoke<void>("delete_chat", { id });
}

// =============================================================
// Message（§4.2）
// =============================================================

/** `list_messages({ chatId }) -> Message[]` */
function listMessages(chatId: string): Promise<Message[]> {
  return invoke<Message[]>("list_messages", { chatId });
}

/**
 * `send_message({ chatId, content }) -> { userMessage }`
 *
 * AI 流回复通过 `lib/events.ts` 的 `aiEvents.onStart/onChunk/onEnd/onError` 订阅。
 */
function sendMessage(
  chatId: string,
  content: string,
): Promise<SendMessageResult> {
  return invoke<SendMessageResult>("send_message", { chatId, content });
}

/**
 * `delete_message({ chatId, assistantId }) -> void`
 *
 * 删除一条 AI 回复（连同配对的 user 提问一起）。后端在事务内：
 * 1. 找配对的 user message
 * 2. 解绑 favorites 的 `source_message_id`（保留收藏内容）
 * 3. 删两条 messages
 *
 * 不存在时返回 `NotFound` 错误。
 */
function deleteMessage(chatId: string, assistantId: string): Promise<void> {
  return invoke<void>("delete_message", { chatId, assistantId });
}

// =============================================================
// AI 控制（§4.3）
// =============================================================

/** `stop_generation({ chatId }) -> void` */
function stopGeneration(chatId: string): Promise<void> {
  return invoke<void>("stop_generation", { chatId });
}

// =============================================================
// Favorite（§4.4）
// =============================================================

/** `create_favorite({ title, content, sourceChatId, sourceMessageId }) -> Favorite` */
function createFavorite(
  title: string,
  content: string,
  sourceChatId: string | null,
  sourceMessageId: string | null,
): Promise<Favorite> {
  return invoke<Favorite>("create_favorite", {
    title,
    content,
    sourceChatId,
    sourceMessageId,
  });
}

/** `list_favorites({}) -> Favorite[]` */
function listFavorites(): Promise<Favorite[]> {
  return invoke<Favorite[]>("list_favorites");
}

/** `get_favorite({ id }) -> Favorite` */
function getFavorite(id: string): Promise<Favorite> {
  return invoke<Favorite>("get_favorite", { id });
}

/**
 * `update_favorite({ id, patch: { title?, content? } }) -> Favorite`
 *
 * 缺省字段不更新（保留原值）。
 */
function updateFavorite(
  id: string,
  patch: FavoritePatch,
): Promise<Favorite> {
  return invoke<Favorite>("update_favorite", { id, patch });
}

/** `get_favorite_by_message_id({ sourceMessageId }) -> Favorite | null` */
function getFavoriteByMessageId(sourceMessageId: string): Promise<Favorite | null> {
  return invoke<Favorite | null>("get_favorite_by_message_id", { sourceMessageId });
}

/** `delete_favorite({ id }) -> void` */
function deleteFavorite(id: string): Promise<void> {
  return invoke<void>("delete_favorite", { id });
}

/** `count_favorites_by_chat({ chatId }) -> number`（Chat 头部 ⭐ 徽章） */
function countFavoritesByChat(chatId: string): Promise<number> {
  return invoke<number>("count_favorites_by_chat", { chatId });
}

// =============================================================
// Role（§4.x）
// =============================================================

/** `create_role({ name, responsibility }) -> Role` */
function createRole(name: string, responsibility: string): Promise<Role> {
  return invoke<Role>("create_role", { name, responsibility });
}

/** `list_roles({}) -> Role[]` */
function listRoles(): Promise<Role[]> {
  return invoke<Role[]>("list_roles");
}

/** `get_role({ id }) -> Role` */
function getRole(id: string): Promise<Role> {
  return invoke<Role>("get_role", { id });
}

/** `update_role({ id, name?, responsibility? }) -> Role` */
function updateRole(
  id: string,
  name: string | null,
  responsibility: string | null,
): Promise<Role> {
  return invoke<Role>("update_role", { id, name, responsibility });
}

/** `delete_role({ id }) -> void` */
function deleteRole(id: string): Promise<void> {
  return invoke<void>("delete_role", { id });
}

/** `get_role_by_chat_id({ chatId }) -> Role` */
function getRoleByChatId(chatId: string): Promise<Role> {
  return invoke<Role>("get_role_by_chat_id", { chatId });
}

// =============================================================
// Settings（§4.5）
// =============================================================

/** `get_settings({}) -> Settings` */
function getSettings(): Promise<Settings> {
  return invoke<Settings>("get_settings");
}

/** `set_api_key({ key }) -> Settings`（空串视为清除） */
function setApiKey(key: string): Promise<Settings> {
  return invoke<Settings>("set_api_key", { key });
}

export const tauri = {
  // Chat
  createChat,
  listChats,
  getChat,
  renameChat,
  setChatRole,
  deleteChat,
  // Message
  listMessages,
  sendMessage,
  deleteMessage,
  // AI
  stopGeneration,
  // Favorite
  createFavorite,
  listFavorites,
  getFavorite,
  getFavoriteByMessageId,
  updateFavorite,
  deleteFavorite,
  countFavoritesByChat,
  // Role
  createRole,
  listRoles,
  getRole,
  updateRole,
  deleteRole,
  getRoleByChatId,
  // Settings
  getSettings,
  setApiKey,
} as const;