/**
 * groupStore（分组管理）
 *
 * 统一管理对话(chat)、收藏(favorite)、模型角色(role)三种资源的分组。
 * 每个资源类型独立维护一组 Group。
 *
 * ## 关键不变量
 * - 分组操作成功后自动重新加载该资源类型的分组列表
 * - 条目的移动/移出由调用方在成功后自行刷新对应 item store（保持单一职责）
 */

import { create } from "zustand";

import { tauri } from "@/lib/tauri";
import type { Group, ResourceType } from "@/types/models";

interface GroupState {
  // 按资源类型缓存分组
  groupsByType: Record<ResourceType, Group[]>;
  status: "empty" | "loading" | "ready" | "error";
  error: string | null;

  // ===== actions =====
  loadGroups: (resourceType: ResourceType) => Promise<void>;
  createGroup: (resourceType: ResourceType, name: string) => Promise<Group | null>;
  renameGroup: (resourceType: ResourceType, id: string, name: string) => Promise<void>;
  deleteGroup: (resourceType: ResourceType, id: string) => Promise<void>;
  moveItemToGroup: (
    resourceType: ResourceType,
    itemId: string,
    groupId: string,
  ) => Promise<void>;
  moveItemOutOfGroup: (resourceType: ResourceType, itemId: string) => Promise<void>;

  // ===== utility =====
  clearError: () => void;
}

const initialGroups: Record<ResourceType, Group[]> = {
  chat: [],
  favorite: [],
  role: [],
};

export const useGroupStore = create<GroupState>()((set, get) => ({
  groupsByType: initialGroups,
  status: "empty",
  error: null,

  loadGroups: async (resourceType) => {
    set({ status: "loading", error: null });
    try {
      const groups = await tauri.listGroups(resourceType);
      set((s) => ({
        groupsByType: { ...s.groupsByType, [resourceType]: groups },
        status: "ready",
        error: null,
      }));
    } catch (e) {
      set({ status: "error", error: toMessage(e) });
    }
  },

  createGroup: async (resourceType, name) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      set({ error: "分组名称不能为空" });
      return null;
    }
    try {
      const group = await tauri.createGroup(resourceType, trimmed);
      await get().loadGroups(resourceType);
      return group;
    } catch (e) {
      set({ error: toMessage(e) });
      return null;
    }
  },

  renameGroup: async (resourceType, id, name) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      set({ error: "分组名称不能为空" });
      return;
    }
    try {
      await tauri.renameGroup(id, trimmed);
      await get().loadGroups(resourceType);
    } catch (e) {
      set({ error: toMessage(e) });
    }
  },

  deleteGroup: async (resourceType, id) => {
    try {
      await tauri.deleteGroup(id);
      await get().loadGroups(resourceType);
    } catch (e) {
      set({ error: toMessage(e) });
    }
  },

  moveItemToGroup: async (resourceType, itemId, groupId) => {
    try {
      await tauri.moveItemToGroup(resourceType, itemId, groupId);
    } catch (e) {
      set({ error: toMessage(e) });
      throw e;
    }
  },

  moveItemOutOfGroup: async (resourceType, itemId) => {
    try {
      await tauri.moveItemOutOfGroup(resourceType, itemId);
    } catch (e) {
      set({ error: toMessage(e) });
      throw e;
    }
  },

  clearError: () => set({ error: null }),
}));

function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}
