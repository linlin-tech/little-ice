/**
 * favoriteStore（§6.5）
 *
 * Favorite 列表 + 当前 favorite + 自动/手动保存标志。
 *
 * ## 关键不变量
 * - `isDirty` = 内容/标题变化即置 true
 * - `isSaving` 防止并发保存（自动 10s 轮询 + 手动保存都要判）
 * - 标题变化走 `renameFavorite`（实时，Enter/Blur 触发）
 * - 内容变化只置 `isDirty = true`，由 `useFavoriteAutoSave` hook 10s 轮询
 *
 * ## 错误约定
 * 所有 invoke 都 try/catch，错误写 `error` 字段。
 * UI 用 `InlineMessage` 展示。
 *
 * ## FavoritePatch 字段语义
 * specta v2 把 `Option<String>` 渲染为 `string | null`（非可选）—— 调用方必须
 * 显式传 `null` 表达"不更新"（Rust 端 `patch.title.unwrap_or(current.title)` 语义）。
 */

import { create } from "zustand";

import { tauri } from "@/lib/tauri";
import type {
  Favorite,
  Id,
  ResourceStatus,
  Timestamp,
} from "@/types/models";

interface FavoriteState {
  // 列表
  favorites: Favorite[];
  status: ResourceStatus;
  error: string | null;

  // 当前
  currentFavoriteId: Id | null;
  currentFavorite: Favorite | null;

  // 自动保存状态
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Timestamp | null;

  // ===== actions =====
  loadFavorites: () => Promise<void>;
  createFavorite: (
    title: string,
    content: string,
    sourceChatId: Id | null,
    sourceMessageId?: Id | null,
  ) => Promise<Favorite | null>;
  selectFavorite: (id: Id) => Promise<void>;
  /** V5.3 新增：列表 hover 编辑 / 详情页 Enter & Blur 都走这个 */
  renameFavorite: (id: Id, title: string) => Promise<void>;
  /** 内容变化：置 isDirty = true，等 10s 轮询或 manualSave 触发 */
  updateContent: (id: Id, content: string) => Promise<void>;
  /** 手动保存（详情页 SaveButton） */
  manualSave: () => Promise<void>;
  /** V5.3：仅列表 hover 区触发 */
  deleteFavorite: (id: Id) => Promise<void>;

  // ===== utility =====
  clearError: () => void;
}

export const useFavoriteStore = create<FavoriteState>()((set, get) => ({
  favorites: [],
  status: "empty",
  error: null,

  currentFavoriteId: null,
  currentFavorite: null,

  isDirty: false,
  isSaving: false,
  lastSavedAt: null,

  // ===== 列表 =====

  loadFavorites: async () => {
    set({ status: "loading", error: null });
    try {
      const favorites = await tauri.listFavorites();
      set({ favorites, status: "ready", error: null });
    } catch (e) {
      set({ status: "error", error: toMessage(e) });
    }
  },

  createFavorite: async (title, content, sourceChatId, sourceMessageId = null) => {
    try {
      const fav = await tauri.createFavorite(title, content, sourceChatId, sourceMessageId ?? null);
      set((s) => ({ favorites: [fav, ...s.favorites] }));
      return fav;
    } catch (e) {
      set({ error: toMessage(e) });
      return null;
    }
  },

  deleteFavorite: async (id) => {
    try {
      await tauri.deleteFavorite(id);
      set((s) => {
        const isCurrent = s.currentFavoriteId === id;
        return {
          favorites: s.favorites.filter((f) => f.id !== id),
          ...(isCurrent && {
            currentFavoriteId: null,
            currentFavorite: null,
            isDirty: false,
            lastSavedAt: null,
          }),
        };
      });
    } catch (e) {
      set({ error: toMessage(e) });
    }
  },

  selectFavorite: async (id) => {
    // 切 favorite 前：若 isDirty，立即保存（§7.1 规则）
    const state = get();
    if (state.isDirty && state.currentFavoriteId && state.currentFavorite) {
      try {
        await tauri.updateFavorite(state.currentFavoriteId, {
          content: state.currentFavorite.content,
          title: null, // 只更新 content
        });
      } catch (e) {
        set({ error: toMessage(e) });
        // 仍继续切换，不阻塞 UI
      }
    }

    set({
      currentFavoriteId: id,
      currentFavorite: null,
      isDirty: false,
      isSaving: false,
      lastSavedAt: null,
    });

    if (id === null) return;

    try {
      const fav = await tauri.getFavorite(id);
      set({ currentFavorite: fav });
    } catch (e) {
      set({ error: toMessage(e) });
    }
  },

  // ===== 实时保存（标题）=====

  renameFavorite: async (id, title) => {
    // 标题变化 → 立即保存（不走 10s 轮询；§7.1 规则）
    try {
      const updated = await tauri.updateFavorite(id, {
        title,
        content: null, // 只更新 title
      });
      set((s) => {
        const isCurrent = s.currentFavoriteId === id;
        return {
          favorites: s.favorites.map((f) => (f.id === id ? updated : f)),
          ...(isCurrent && {
            currentFavorite: updated,
            lastSavedAt: Date.now(),
          }),
        };
      });
    } catch (e) {
      set({ error: toMessage(e) });
    }
  },

  // ===== 内容变化 =====

  updateContent: async (id, content) => {
    // 仅置 isDirty；不动后端；不动 currentFavorite.content
    // 实际持久化由 useFavoriteAutoSave hook 10s 轮询 + manualSave 触发
    set((s) => {
      if (s.currentFavoriteId !== id) return s;
      return {
        currentFavorite:
          s.currentFavorite === null
            ? null
            : { ...s.currentFavorite, content },
        isDirty: true,
      };
    });
  },

  manualSave: async () => {
    const state = get();
    if (!state.currentFavoriteId || !state.currentFavorite) return;
    if (state.isSaving) return; // 防并发
    if (!state.isDirty) return; // 没东西要保存

    set({ isSaving: true });
    try {
      const updated = await tauri.updateFavorite(state.currentFavoriteId, {
        content: state.currentFavorite.content,
        title: null, // 只更新 content
      });
      set((s) => {
        const isCurrent = s.currentFavoriteId === updated.id;
        return {
          favorites: s.favorites.map((f) => (f.id === updated.id ? updated : f)),
          ...(isCurrent && {
            currentFavorite: updated,
            isDirty: false,
            lastSavedAt: Date.now(),
          }),
        };
      });
    } catch (e) {
      set({ error: toMessage(e) });
    } finally {
      set({ isSaving: false });
    }
  },

  // ===== utility =====

  clearError: () => set({ error: null }),
}));

// =============================================================
// helpers
// =============================================================

function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}
