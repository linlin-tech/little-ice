/**
 * draftStore（§6.2）
 *
 * 聊天输入框的**未发送草稿**——用户键入后切走 / 关窗都不会丢。
 * 使用 zustand `persist` 中间件 + `localStorage`，键名 `little-ice-chat-draft`。
 *
 * **绝不**把 `messages` / `aiState` 放进 persist（§7.2）。
 *
 * 用法：
 * ```ts
 * const draft = useDraftStore((s) => s.draft);
 * const setDraft = useDraftStore((s) => s.setDraft);
 * const clearDraft = useDraftStore((s) => s.clearDraft);
 *
 * // 发送成功后必须清空
 * await sendMessage(content);
 * clearDraft();
 * ```
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { DraftState } from "@/types/models";

interface DraftStore {
  draft: string;
  draftState: DraftState;

  setDraft: (s: string) => void;
  clearDraft: () => void;
}

export const useDraftStore = create<DraftStore>()(
  persist(
    (set) => ({
      draft: "",
      draftState: "editing",

      setDraft: (s) =>
        set({
          draft: s,
          draftState: s.trim().length > 0 ? "editing" : "editing",
        }),
      clearDraft: () => set({ draft: "", draftState: "editing" }),
    }),
    {
      name: "little-ice-chat-draft",
      storage: createJSONStorage(() => localStorage),
      // 只持久化必要字段；`draftState` 是冗余，可省略
      partialize: (s) => ({ draft: s.draft }),
    },
  ),
);
