/**
 * roleStore（§6.x）
 *
 * Role 列表 + 当前选中的 role + CRUD。
 *
 * ## 关键不变量
 * - 系统内置角色（isBuiltin = true）不可编辑名称/职责/删除
 * - 创建 role 后立即选中
 * - 删除 role 后清空选中（或被选中的 role 被删除）
 */

import { create } from "zustand";

import { tauri } from "@/lib/tauri";
import type { Id, ResourceStatus, Role } from "@/types/models";

interface RoleState {
  // 列表
  roles: Role[];
  status: ResourceStatus;
  error: string | null;

  // 当前
  selectedRoleId: Id | null;

  // ===== actions =====
  loadRoles: () => Promise<void>;
  createRole: () => Promise<Role | null>;
  updateRole: (id: Id, name: string, responsibility: string) => Promise<void>;
  deleteRole: (id: Id) => Promise<void>;
  selectRole: (id: Id | null) => void;

  // ===== utility =====
  clearError: () => void;
}

export const useRoleStore = create<RoleState>()((set) => ({
  roles: [],
  status: "empty",
  error: null,

  selectedRoleId: null,

  loadRoles: async () => {
    set({ status: "loading", error: null });
    try {
      const roles = await tauri.listRoles();
      set({ roles, status: "ready", error: null });
    } catch (e) {
      set({ status: "error", error: toMessage(e) });
    }
  },

  createRole: async () => {
    try {
      const role = await tauri.createRole("新角色", "");
      set((s) => {
        // 新建角色插入到「最后一个内置角色之后」，
        // 保证系统内置角色（默认助手）始终保持在列表最上方，
        // 且新角色紧跟在默认角色下面。
        const lastBuiltinIdx = s.roles.reduce(
          (lastIdx, r, i) => (r.isBuiltin ? i : lastIdx),
          -1,
        );
        const next = [...s.roles];
        next.splice(lastBuiltinIdx + 1, 0, role);
        return {
          roles: next,
          selectedRoleId: role.id,
        };
      });
      return role;
    } catch (e) {
      set({ error: toMessage(e) });
      return null;
    }
  },

  updateRole: async (id, name, responsibility) => {
    try {
      const updated = await tauri.updateRole(id, name, responsibility);
      set((s) => ({
        roles: s.roles.map((r) => (r.id === id ? updated : r)),
      }));
    } catch (e) {
      set({ error: toMessage(e) });
    }
  },

  deleteRole: async (id) => {
    try {
      await tauri.deleteRole(id);
      set((s) => ({
        roles: s.roles.filter((r) => r.id !== id),
        selectedRoleId: s.selectedRoleId === id ? null : s.selectedRoleId,
      }));
    } catch (e) {
      set({ error: toMessage(e) });
    }
  },

  selectRole: (id) => {
    set({ selectedRoleId: id });
  },

  clearError: () => set({ error: null }),
}));

function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}
