/**
 * settingsStore（§6.3）
 *
 * Settings 状态：API key 等。
 * - 启动时**主动 load** 一次（不是 store 内部自动）
 * - 保存时**实时**写库（无 Save 按钮，UX 文档第 14 章）
 * - 所有 invoke 都 try/catch，错误写 `error` 字段（UI 用 `InlineMessage` 展示）
 */

import { create } from "zustand";

import { tauri } from "@/lib/tauri";
import type { ResourceStatus, Settings } from "@/types/models";

interface SettingsState {
  settings: Settings;
  status: ResourceStatus;
  error: string | null;

  /** 启动时调用一次（建议在 main.tsx 渲染 App 前 await） */
  load: () => Promise<void>;
  /** 实时写入（无 Save 按钮，UX §14） */
  saveApiKey: (key: string) => Promise<void>;
  /** UI 上清除错误（如 InlineMessage 关闭时） */
  clearError: () => void;
}

const emptySettings: Settings = {
  deepseekApiKey: "",
  hasApiKey: false,
};

export const useSettingsStore = create<SettingsState>()((set) => ({
  settings: emptySettings,
  status: "empty",
  error: null,

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const settings = await tauri.getSettings();
      set({ settings, status: "ready", error: null });
    } catch (e) {
      set({ status: "error", error: toMessage(e) });
    }
  },

  saveApiKey: async (key) => {
    // 注意：不切 status="loading"——键入保存要"无感"（不能闪烁 loading）
    set({ error: null });
    try {
      const settings = await tauri.setApiKey(key);
      set({ settings, error: null });
    } catch (e) {
      set({ error: toMessage(e) });
      throw e; // 让 UI 决定是否再提示
    }
  },

  clearError: () => set({ error: null }),
}));

/** 把后端 `AppError::Serialize as String` 的字符串错误规整（去掉 trailing period） */
function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}
