/**
 * chatStore（§6.4）
 *
 * 负责 chat 列表 + 当前 chat 的 messages + AI 流状态机。
 *
 * ## 关键不变量（§6.4 末尾）
 * - `streamingMessageId` 与 `messages` 数组中**最后一条 `assistant` 消息**的 id 一致
 * - 切换 `currentChatId` 时：清空 `messages`、`aiState = 'idle'`、`streamingMessageId = null`
 *
 * ## AI 状态机（§5.3 / UX §9）
 * ```
 * idle --sendMessage-->  sending
 * sending --start-->     generating
 * generating --chunk-->  generating
 * generating --end-->    completed | stopped
 * generating --error-->  failed
 * sending | generating --stop--> stopped
 * ```
 *
 * ## 事件 handler
 * `onStream*` 4 个回调由 `main.tsx` 在 `useEffect` 中通过 `aiEvents.onAll()` 订阅，
 * 在切换 chat / unmount 时务必 unlisten（防止状态污染）。
 *
 * ## 错误约定
 * 所有 invoke 调用都 try/catch，错误字符串写 `error` 字段。
 * UI 层用 `InlineMessage` 展示 `error`（不弹 alert / 不阻塞）。
 *
 * ## 消息顺序保证（修复 send_message 与 ai-stream-start 之间的竞争）
 *
 * 后端 `send_message`：先持久化 user + assistant 占位，再 `tokio::spawn` 启动流，
 * 再返回 `userMessage`。前端 `sendMessage` 与 `ai-stream-start` 事件**到达顺序不固定**：
 *
 * - 顺序 A（userMsg 先到）：messages = [...prev, userMsg] → Start → messages = [...prev, userMsg, placeholder] ✅
 * - 顺序 B（Start 先到）：  Start → messages = [...prev, placeholder] → userMsg → messages = [...prev, placeholder, userMsg] ❌
 *   → 用户看到 AI 占位（"思考中…"）在 userMsg 之上，对话顺序颠倒
 *
 * 修复：`onStreamStart` 若发现末尾不是 userMsg，则不立即 append，而是把占位暂存
 * 到 `pendingAssistant`，等 `sendMessage` 返回 userMsg 时再 append userMsg + 占位。
 * chunks / end 在 pending 期间累积到 `pendingAssistant.placeholder.content`，
 * 后续追加时一次写入。
 */

import { create } from "zustand";

import { aiEvents } from "@/lib/events";
import { tauri } from "@/lib/tauri";
import type {
  AiState,
  AiStreamChunk,
  AiStreamEnd,
  AiStreamError,
  AiStreamStart,
  Chat,
  Id,
  Message,
  ResourceStatus,
} from "@/types/models";

/**
 * 占位 assistant 消息：在 onStreamStart 先于 sendMessage 返回到达时暂存，
 * 待 sendMessage 把 userMsg 写进 messages 后，再追加到 messages 末尾。
 */
interface PendingAssistant {
  placeholder: Message;
  /** chunks 在 pending 期间累积的 content（end 时会被 fullContent 覆盖） */
  accumulatedContent: string;
}

interface ChatState {
  // 列表
  chats: Chat[];
  status: ResourceStatus;
  error: string | null;

  // 当前 chat
  currentChatId: Id | null;
  messages: Message[];
  messagesStatus: ResourceStatus;

  // AI 流
  aiState: AiState;
  streamingMessageId: Id | null;
  /** 容错用：buffer 累积的 delta，最后用 `ai-stream-end.fullContent` 校正 */
  streamingDeltaBuffer: string;

  /** 当前 chat 被收藏的次数（V1.3 启用，Chat 头部 ⭐ 徽章用） */
  favoriteCount: number;

  /**
   * Start 事件先于 sendMessage 返回时，把 assistant 占位暂存在这里，
   * 避免用户提问被 AI 占位推到下面（顺序颠倒）。
   */
  pendingAssistant: PendingAssistant | null;

  // ===== actions =====
  loadChats: () => Promise<void>;
  createChat: (title: string) => Promise<Chat | null>;
  deleteChat: (id: Id) => Promise<void>;
  renameChat: (id: Id, title: string) => Promise<void>;
  setChatRole: (id: Id, roleId: Id) => Promise<void>;
  selectChat: (id: Id) => Promise<void>;

  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => Promise<void>;

  loadFavoriteCount: (chatId: Id) => Promise<void>;

  // ===== event handlers（在 main.tsx 中通过 aiEvents.onAll 注册）=====
  onStreamStart: (p: AiStreamStart) => void;
  onStreamChunk: (p: AiStreamChunk) => void;
  onStreamEnd: (p: AiStreamEnd) => void;
  onStreamError: (p: AiStreamError) => void;

  // ===== utility =====
  clearError: () => void;
}

const emptyMessages: Message[] = [];

export const useChatStore = create<ChatState>()((set, get) => ({
  // ----- 初始状态 -----
  chats: [],
  status: "empty",
  error: null,

  currentChatId: null,
  messages: emptyMessages,
  messagesStatus: "empty",

  aiState: "idle",
  streamingMessageId: null,
  streamingDeltaBuffer: "",

  favoriteCount: 0,
  pendingAssistant: null,

  // ===== 列表 =====

  loadChats: async () => {
    set({ status: "loading", error: null });
    try {
      const chats = await tauri.listChats();
      set({ chats, status: "ready", error: null });
    } catch (e) {
      set({ status: "error", error: toMessage(e) });
    }
  },

  createChat: async (title) => {
    try {
      const chat = await tauri.createChat(title);
      set((s) => ({ chats: [chat, ...s.chats] }));
      return chat;
    } catch (e) {
      set({ error: toMessage(e) });
      return null;
    }
  },

  deleteChat: async (id) => {
    try {
      await tauri.deleteChat(id);
      set((s) => {
        const isCurrent = s.currentChatId === id;
        return {
          chats: s.chats.filter((c) => c.id !== id),
          // 删的是当前 chat：清空 messages / 重置 AI 状态
          ...(isCurrent && {
            currentChatId: null,
            messages: emptyMessages,
            messagesStatus: "empty",
            aiState: "idle",
            streamingMessageId: null,
            streamingDeltaBuffer: "",
            favoriteCount: 0,
            pendingAssistant: null,
          }),
        };
      });
    } catch (e) {
      set({ error: toMessage(e) });
    }
  },

  renameChat: async (id, title) => {
    try {
      const updated = await tauri.renameChat(id, title);
      set((s) => ({
        chats: s.chats.map((c) => (c.id === id ? updated : c)),
      }));
    } catch (e) {
      set({ error: toMessage(e) });
    }
  },

  setChatRole: async (id, roleId) => {
    try {
      const updated = await tauri.setChatRole(id, roleId);
      set((s) => ({
        chats: s.chats.map((c) => (c.id === id ? updated : c)),
      }));
    } catch (e) {
      set({ error: toMessage(e) });
    }
  },

  selectChat: async (id) => {
    // 切 chat：清空 messages + 重置 AI 状态（§6.4 关键不变量）
    set({
      currentChatId: id,
      messages: emptyMessages,
      messagesStatus: "loading",
      aiState: "idle",
      streamingMessageId: null,
      streamingDeltaBuffer: "",
      error: null,
      pendingAssistant: null,
    });
    if (id === null) {
      set({ messages: emptyMessages, messagesStatus: "empty" });
      return;
    }
    try {
      const [messages, favoriteCount] = await Promise.all([
        tauri.listMessages(id),
        tauri.countFavoritesByChat(id),
      ]);
      set({ messages, messagesStatus: "ready", favoriteCount });
    } catch (e) {
      set({ messagesStatus: "error", error: toMessage(e) });
    }
  },

  // ===== AI 流 =====

  sendMessage: async (content) => {
    const chatId = get().currentChatId;
    if (!chatId) {
      set({ error: "未选中任何 chat" });
      return;
    }
    if (content.trim().length === 0) return;

    set({ aiState: "sending", error: null });
    try {
      const { userMessage } = await tauri.sendMessage(chatId, content);
      // userMsg 到位后追加；
      // 若 Start 事件已先到（pendingAssistant 非空），把占位也一并追加在 userMsg 之后，
      // 保证顺序 user → assistant，不会出现 AI 占位跑到用户提问上方的颠倒问题。
      set((s) => {
        const next = [...s.messages, userMessage];
        let pending = s.pendingAssistant;
        if (pending && pending.placeholder.chatId === chatId) {
          next.push({
            ...pending.placeholder,
            content: pending.accumulatedContent,
          });
          pending = null;
        }
        return { messages: next, pendingAssistant: pending };
      });
      // 不在这里设置 idle/completed——等 ai-stream-end/error 事件
    } catch (e) {
      set({
        aiState: "failed",
        error: toMessage(e),
        pendingAssistant: null,
      });
    }
  },

  stopGeneration: async () => {
    const chatId = get().currentChatId;
    if (!chatId) return;
    try {
      await tauri.stopGeneration(chatId);
      // ai-stream-end 事件会带 stopped=true 到达，那时再切 aiState
    } catch (e) {
      set({ error: toMessage(e) });
    }
  },

  loadFavoriteCount: async (chatId) => {
    try {
      const count = await tauri.countFavoritesByChat(chatId);
      // 只在仍是当前 chat 时更新（防止切走时覆盖）
      if (get().currentChatId === chatId) {
        set({ favoriteCount: count });
      }
    } catch (e) {
      // 徽章不显眼：吞错，不污染 error
      console.warn("loadFavoriteCount failed:", e);
    }
  },

  // ===== event handlers =====

  onStreamStart: (p) => {
    // 只响应当前 chat 的事件（防止切 chat 期间事件污染）
    if (p.chatId !== get().currentChatId) return;

    const placeholder: Message = {
      id: p.assistantMessageId,
      chatId: p.chatId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };

    set((s) => {
      const last = s.messages[s.messages.length - 1];
      const lastIsUserForThisChat =
        last !== undefined &&
        last.role === "user" &&
        last.chatId === p.chatId;

      if (lastIsUserForThisChat) {
        // 正常顺序：userMsg 已在末尾，直接追加 assistant 占位
        return {
          messages: [...s.messages, placeholder],
          streamingMessageId: p.assistantMessageId,
          streamingDeltaBuffer: "",
          aiState: "generating",
          pendingAssistant: null,
        };
      }
      // 竞争情况：Start 早于 sendMessage 返回。把占位暂存到 pendingAssistant，
      // 等 sendMessage 把 userMsg 写入后再一并追加。
      return {
        streamingMessageId: p.assistantMessageId,
        streamingDeltaBuffer: "",
        aiState: "generating",
        pendingAssistant: { placeholder, accumulatedContent: "" },
      };
    });
  },

  onStreamChunk: (p) => {
    if (p.chatId !== get().currentChatId) return;

    set((s) => {
      // 1) messages 中已存在的 assistant 消息：正常 append
      const idx = s.messages.findIndex((m) => m.id === p.assistantMessageId);
      if (idx >= 0) {
        const updated = [...s.messages];
        const target = updated[idx]!;
        updated[idx] = { ...target, content: target.content + p.delta };
        return {
          messages: updated,
          streamingDeltaBuffer: s.streamingDeltaBuffer + p.delta,
        };
      }
      // 2) Start 抢跑、占位还在 pendingAssistant：累积到 accumulatedContent
      if (
        s.pendingAssistant !== null &&
        s.pendingAssistant.placeholder.id === p.assistantMessageId
      ) {
        return {
          streamingDeltaBuffer: s.streamingDeltaBuffer + p.delta,
          pendingAssistant: {
            placeholder: s.pendingAssistant.placeholder,
            accumulatedContent:
              s.pendingAssistant.accumulatedContent + p.delta,
          },
        };
      }
      // 3) Start 事件没收到（极端情况）：丢弃 chunk
      return s;
    });
  },

  onStreamEnd: (p) => {
    if (p.chatId !== get().currentChatId) return;

    set((s) => {
      // 1) messages 中已存在：覆盖 content 为 fullContent
      const idx = s.messages.findIndex((m) => m.id === p.assistantMessageId);
      if (idx >= 0) {
        const updated = [...s.messages];
        updated[idx] = { ...updated[idx]!, content: p.fullContent };
        return {
          messages: updated,
          streamingDeltaBuffer: "",
          streamingMessageId: null,
          aiState: p.stopped ? "stopped" : "completed",
          pendingAssistant: null,
        };
      }
      // 2) pendingAssistant：把 fullContent 写入，待 sendMessage 一并 append
      if (
        s.pendingAssistant !== null &&
        s.pendingAssistant.placeholder.id === p.assistantMessageId
      ) {
        return {
          streamingDeltaBuffer: "",
          streamingMessageId: null,
          aiState: p.stopped ? "stopped" : "completed",
          pendingAssistant: {
            placeholder: s.pendingAssistant.placeholder,
            accumulatedContent: p.fullContent,
          },
        };
      }
      return s;
    });
  },

  onStreamError: (p) => {
    if (p.chatId !== get().currentChatId) return;

    set({
      aiState: "failed",
      streamingMessageId: null,
      streamingDeltaBuffer: "",
      error: `[${p.error.type}] ${p.error.message}`,
      pendingAssistant: null,
    });
  },

  clearError: () => set({ error: null }),
}));

/** 全局 `useEffect` 一次性订阅（main.tsx 启动时调用） */
export async function bindChatStreamEvents(): Promise<() => void> {
  return aiEvents.onAll({
    onStart: (p) => useChatStore.getState().onStreamStart(p),
    onChunk: (p) => useChatStore.getState().onStreamChunk(p),
    onEnd: (p) => useChatStore.getState().onStreamEnd(p),
    onError: (p) => useChatStore.getState().onStreamError(p),
  });
}

// =============================================================
// helpers
// =============================================================

function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}
