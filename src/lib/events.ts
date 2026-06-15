/**
 * AI 流式事件订阅封装
 *
 * 事件名 + payload 字段名与后端 §5 / §7.1 严格 1:1。
 *
 * 用法：
 * ```ts
 * import { aiEvents } from "@/lib/events";
 *
 * const unlisten = await aiEvents.onChunk((p) => {
 *   console.log(p.chatId, p.delta);
 * });
 *
 * // 切换 chat 时必须 unlisten
 * unlisten();
 * ```
 *
 * `listen` 返回的 `UnlistenFn` 由调用方负责调用（zudante 在 `useEffect` cleanup 中调）。
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import {
  AiEvent,
  type AiStreamChunk,
  type AiStreamEnd,
  type AiStreamError,
  type AiStreamStart,
} from "@/types/models";

async function onStart(cb: (p: AiStreamStart) => void): Promise<UnlistenFn> {
  return listen<AiStreamStart>(AiEvent.Start, (e) => cb(e.payload));
}

async function onChunk(cb: (p: AiStreamChunk) => void): Promise<UnlistenFn> {
  return listen<AiStreamChunk>(AiEvent.Chunk, (e) => cb(e.payload));
}

async function onEnd(cb: (p: AiStreamEnd) => void): Promise<UnlistenFn> {
  return listen<AiStreamEnd>(AiEvent.End, (e) => cb(e.payload));
}

async function onError(cb: (p: AiStreamError) => void): Promise<UnlistenFn> {
  return listen<AiStreamError>(AiEvent.Error, (e) => cb(e.payload));
}

/**
 * 一次性订阅所有 4 个事件。回调各自独立，**不保证事件顺序**。
 * 切换 chat 时需要 unlisten + 重新 listen。
 */
async function onAll(cb: {
  onStart?: (p: AiStreamStart) => void;
  onChunk?: (p: AiStreamChunk) => void;
  onEnd?: (p: AiStreamEnd) => void;
  onError?: (p: AiStreamError) => void;
}): Promise<UnlistenFn> {
  const unlistens: UnlistenFn[] = [];
  if (cb.onStart) unlistens.push(await onStart(cb.onStart));
  if (cb.onChunk) unlistens.push(await onChunk(cb.onChunk));
  if (cb.onEnd) unlistens.push(await onEnd(cb.onEnd));
  if (cb.onError) unlistens.push(await onError(cb.onError));
  return () => unlistens.forEach((u) => u());
}

export const aiEvents = { onStart, onChunk, onEnd, onError, onAll };
