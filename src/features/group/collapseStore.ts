/**
 * groupCollapseStore（§6.5 扩展）
 *
 * 持久化「分组展开 / 收缩」状态。覆盖三种资源类型（chat / favorite / role）。
 *
 * ## 持久化策略
 * - 物理层：`@tauri-apps/plugin-store`（`ui-prefs.json`）
 * - 模型层：本 zustand store，组件订阅
 * - 同步：状态变化时**直接写 plugin-store 并 save**；启动时**一次性 load**
 *   到内存，后续所有读路径走内存（O(1)，不阻塞渲染）
 *
 * ## 「默认展开」语义
 * - 分组：store 中**只记录已收缩的 id**；不在列表中的视为展开
 *   - 优点：新建分组默认展开，删除分组无需清理 store
 *   - 缺点：偶尔需要清理"已删除分组的残留 id"（在 set 阶段做 GC）
 * - 「未分组」区域：用一个布尔记录是否收缩，默认 false（展开）
 *   - 持久化时显式写 false，确保显式语义
 *
 * ## 数据结构
 * ```ts
 * {
 *   collapsed: { chat: string[]; favorite: string[]; role: string[] }
 *   ungroupedCollapsed: { chat: boolean; favorite: boolean; role: boolean }
 * }
 * ```
 */

import { create } from "zustand";

import { getUiPrefs } from "@/lib/persistence";
import type { ResourceType } from "@/types/models";

// =============================================================
// 存储 schema
// =============================================================

/** 持久化在 plugin-store 中的根 key */
const PERSIST_KEY = "group-collapse-v1";

interface PersistedShape {
  /** 已收缩的分组 id（默认展开的不需要记录） */
  collapsed: Record<ResourceType, string[]>;
  /** 「未分组」区域是否被收缩（默认 false = 展开） */
  ungroupedCollapsed: Record<ResourceType, boolean>;
}

const emptyCollapsed: Record<ResourceType, string[]> = {
  chat: [],
  favorite: [],
  role: [],
};

const emptyUngroupedCollapsed: Record<ResourceType, boolean> = {
  chat: false,
  favorite: false,
  role: false,
};

// =============================================================
// store
// =============================================================

export type CollapseLoadStatus = "empty" | "loading" | "ready" | "error";

interface GroupCollapseState {
  collapsed: Record<ResourceType, string[]>;
  ungroupedCollapsed: Record<ResourceType, boolean>;
  status: CollapseLoadStatus;
  error: string | null;

  /** 启动时调用一次（App 启动时 await） */
  load: () => Promise<void>;

  /**
   * 切换分组展开 / 收缩。
   * - 状态变化后立即写入 plugin-store
   * - 自动 GC：把列表中不存在的 id 从 collapsed 中移除（分组被删后无残留）
   */
  toggleGroup: (
    resourceType: ResourceType,
    groupId: string,
    /** 当前所有已知的分组 id 集合（用于 GC） */
    knownGroupIds: ReadonlySet<string>,
  ) => Promise<void>;

  /** 切换「未分组」区域展开 / 收缩。 */
  toggleUngrouped: (resourceType: ResourceType) => Promise<void>;

  /** 便捷查询：某个分组是否被收缩（默认 = 展开） */
  isGroupCollapsed: (resourceType: ResourceType, groupId: string) => boolean;
  /** 便捷查询：「未分组」是否被收缩（默认 false） */
  isUngroupedCollapsed: (resourceType: ResourceType) => boolean;
}

const initialState = {
  collapsed: emptyCollapsed,
  ungroupedCollapsed: emptyUngroupedCollapsed,
  status: "empty" as CollapseLoadStatus,
  error: null as string | null,
};

export const useGroupCollapseStore = create<GroupCollapseState>()((set, get) => ({
  ...initialState,

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const store = await getUiPrefs();
      const persisted = await store.get<PersistedShape>(PERSIST_KEY);
      // 缺失字段用初始值兜底（向前兼容：旧版本没有 ungroupedCollapsed 字段）
      set({
        collapsed: persisted?.collapsed ?? emptyCollapsed,
        ungroupedCollapsed: persisted?.ungroupedCollapsed ?? emptyUngroupedCollapsed,
        status: "ready",
        error: null,
      });
    } catch (e) {
      set({ status: "error", error: toMessage(e) });
    }
  },

  toggleGroup: async (resourceType, groupId, knownGroupIds) => {
    const before = get().collapsed[resourceType];
    const has = before.includes(groupId);
    const nextList = has
      ? before.filter((id) => id !== groupId)
      : [...before, groupId];

    // GC：剔除已不存在的 id（分组被删除后无残留）
    const gcList = nextList.filter((id) => knownGroupIds.has(id));

    set((s) => ({
      collapsed: { ...s.collapsed, [resourceType]: gcList },
    }));
    await persist(set, get);
  },

  toggleUngrouped: async (resourceType) => {
    set((s) => ({
      ungroupedCollapsed: {
        ...s.ungroupedCollapsed,
        [resourceType]: !s.ungroupedCollapsed[resourceType],
      },
    }));
    await persist(set, get);
  },

  isGroupCollapsed: (resourceType, groupId) =>
    get().collapsed[resourceType].includes(groupId),

  isUngroupedCollapsed: (resourceType) =>
    get().ungroupedCollapsed[resourceType],
}));

// =============================================================
// 持久化辅助
// =============================================================

async function persist(
  set: (partial: Partial<GroupCollapseState>) => void,
  get: () => GroupCollapseState,
): Promise<void> {
  try {
    const store = await getUiPrefs();
    const snapshot: PersistedShape = {
      collapsed: get().collapsed,
      ungroupedCollapsed: get().ungroupedCollapsed,
    };
    await store.set(PERSIST_KEY, snapshot);
    await store.save();
  } catch (e) {
    // 持久化失败：内存状态已更新，UI 立即生效；只把错误写入 error 字段便于排查
    set({ error: toMessage(e) });
  }
}

function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}
