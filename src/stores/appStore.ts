/**
 * appStore（§6.1）
 *
 * 纯 UI 导航状态：当前页面 + 当前选中的 chat / favorite + Sidebar 收起状态。
 * **不**持久化（应用重启后回到首页 + 无选中 + Sidebar 默认展开）。
 *
 * 用法：
 * ```ts
 * const view = useAppStore((s) => s.view);
 * const setView = useAppStore((s) => s.setView);
 *
 * const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
 * const toggleSidebar = useAppStore((s) => s.toggleSidebar);
 * ```
 */

import { create } from "zustand";

import type { Id, ViewMode } from "@/types/models";

interface AppState {
  view: ViewMode;
  selectedChatId: Id | null;
  selectedFavoriteId: Id | null;
  sidebarCollapsed: boolean;

  setView: (v: ViewMode) => void;
  selectChat: (id: Id | null) => void;
  selectFavorite: (id: Id | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  view: "chat",
  selectedChatId: null,
  selectedFavoriteId: null,
  sidebarCollapsed: false,

  setView: (v) => set({ view: v }),
  selectChat: (id) => set({ selectedChatId: id }),
  selectFavorite: (id) => set({ selectedFavoriteId: id }),
  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}));
