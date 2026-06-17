/**
 * 数据模型（前端 §3）
 *
 * 业务 model（`Chat` / `Message` / `Favorite` / `Settings` 等）从 `generated.ts`
 * re-export（single source of truth，由 Rust 经 specta 自动生成）。
 *
 * 在此只补充**前端独有**的类型：
 * 1. 基础别名（`Id` / `Timestamp`）
 * 2. 视图/状态机（`ViewMode` / `ResourceStatus` / `AiState` / `DraftState`）
 * 3. AI 事件 payload（`AiStreamStart/Chunk/End/Error`）—— 事件 struct
 *    在 Rust 端 `ai::events` 中定义但 specta 不收集，所以这里手写
 * 4. 错误 type 联合（`AiErrorType`）—— 匹配后端 `classify_error`
 *
 * 流程：
 * 1. 后端改 `src-tauri/src/models/*.rs` 并加 `#[derive(specta::Type)]`
 * 2. 在 `src-tauri/` 下跑 `cargo run --bin gen_types`
 * 3. 新的 model 类型自动出现在 `generated.ts` 中
 * 4. 在本文件中**只需要加 re-export**（无需手写 interface）
 */

// =============================================================
// 基础别名（与 §3 一致）
// =============================================================

/** UUID 字符串 ID（Rust 端生成，前端不构造） */
export type Id = string;

/** Unix 毫秒（number；Rust 端 i64 经 specta opaque → number） */
export type Timestamp = number;

// =============================================================
// 视图/状态机（前端独有）
// =============================================================

export type ViewMode = "chat" | "favorite" | "role" | "settings";

export type ResourceStatus = "empty" | "loading" | "ready" | "error";

/** AI 流状态机（§4.3 + UX §9 状态机表） */
export type AiState =
  | "idle"
  | "sending" // 用户消息已发送，等待首个 token
  | "generating" // 正在流式接收
  | "completed" // 成功完成
  | "failed" // 出错
  | "stopped"; // 用户主动停止

export type DraftState = "editing" | "cached";

// =============================================================
// 错误 type 联合（与后端 `classify_error` 1:1）
// =============================================================

/** 前端 store 把字符串写入 `error` 字段，UI 用 `InlineMessage` 展示 `error.message` */
export type AiErrorType =
  | "network"
  | "model"
  | "timeout"
  | "unknown"
  | "api_key"
  | "validation";

// =============================================================
// AI 事件 payload（与后端 ai::events 1:1，specta 不生成）
// =============================================================

/** `ai-stream-start` 载荷 */
export interface AiStreamStart {
  chatId: Id;
  /** Rust 后端字段名 `assistant_message_id` 经 camelCase 序列化 */
  assistantMessageId: Id;
}

/** `ai-stream-chunk` 载荷 */
export interface AiStreamChunk {
  chatId: Id;
  assistantMessageId: Id;
  /** 本次新增的文本片段 */
  delta: string;
}

/** `ai-stream-end` 载荷 */
export interface AiStreamEnd {
  chatId: Id;
  assistantMessageId: Id;
  /** 完整内容（用于收尾对账） */
  fullContent: string;
  /** `true` = 用户主动停止 */
  stopped: boolean;
}

/** `ai-stream-error` 载荷 */
export interface AiStreamError {
  chatId: Id;
  assistantMessageId: Id;
  error: {
    type: AiErrorType;
    message: string;
  };
}

// =============================================================
// 事件名常量（与后端 ai::events 一致，§5.1）
// =============================================================

export const AiEvent = {
  Start: "ai-stream-start",
  Chunk: "ai-stream-chunk",
  End: "ai-stream-end",
  Error: "ai-stream-error",
} as const;

// =============================================================
// ===== 业务 model（从 generated.ts re-export，single source of truth）=====
// =============================================================

export type {
  Chat,
  Favorite,
  FavoritePatch,
  Message,
  MessageRole,
  Role,
  SendMessageResult,
  Settings,
} from "./generated";
