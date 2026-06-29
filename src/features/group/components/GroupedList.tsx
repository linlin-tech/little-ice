/**
 * GroupedList
 *
 * 通用分组列表容器：按 group_id 将条目分组展示。
 * - 顶部显示「未分组 (N)」默认分组头部（可展开/折叠）
 * - 随后按 groups 顺序渲染各分组（可展开/折叠）
 * - 分组与未分组之间用细线分隔
 *
 * ## 展开 / 收缩状态持久化（§6.5）
 * 通过 `useGroupCollapseStore` 订阅，分组状态存于 `@tauri-apps/plugin-store`：
 * - **只记录已收缩的分组 id**（默认全部展开；新建分组自动展开）
 * - 「未分组」区域用一个布尔显式记录（默认展开）
 * - 切换时立即写盘；启动时一次性 load 到内存
 *
 * 视觉对齐截图/原型：条目卡片左侧带图标，右侧「···」，分组头带计数。
 */

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo } from "react";

import { useChatStore } from "@/features/chat/store";
import { useFavoriteStore } from "@/features/favorite/store";
import { useGroupCollapseStore } from "@/features/group/collapseStore";
import { useGroupStore } from "@/features/group/store";
import { useRoleStore } from "@/features/role/store";
import { useTreeViewStore } from "@/features/tree/store";
import { cn } from "@/lib/utils";
import type { ResourceType } from "@/types/models";

import { GroupHeader } from "./GroupHeader";

interface GroupedListProps<T extends { id: string; groupId: string | null }> {
  resourceType: ResourceType;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  emptyState: React.ReactNode;
  resourceLabel: string;
}

export function GroupedList<T extends { id: string; groupId: string | null }>({
  resourceType,
  items,
  renderItem,
  emptyState,
  resourceLabel: _resourceLabel,
}: GroupedListProps<T>): React.JSX.Element {
  const groups = useGroupStore((s) => s.groupsByType[resourceType]);
  const loadGroups = useGroupStore((s) => s.loadGroups);

  const loadChats = useChatStore((s) => s.loadChats);
  const currentChatId = useChatStore((s) => s.currentChatId);
  const selectChat = useChatStore((s) => s.selectChat);
  const loadFavorites = useFavoriteStore((s) => s.loadFavorites);
  const loadRoles = useRoleStore((s) => s.loadRoles);
  const loadAllNodes = useTreeViewStore((s) => s.loadAllNodes);

  // 展开/收缩：直接订阅 store；切换时调 action（自动写盘 + GC）
  const collapsedIds = useGroupCollapseStore((s) => s.collapsed[resourceType]);
  const ungroupedCollapsed = useGroupCollapseStore(
    (s) => s.ungroupedCollapsed[resourceType],
  );
  const toggleGroup = useGroupCollapseStore((s) => s.toggleGroup);
  const toggleUngrouped = useGroupCollapseStore((s) => s.toggleUngrouped);

  // 按需加载该资源类型的分组
  useEffect(() => {
    if (groups.length === 0) {
      void loadGroups(resourceType);
    }
  }, [resourceType, loadGroups, groups.length]);

  const grouped = useMemo(() => {
    const byGroup = new Map<string, T[]>();
    const ungrouped: T[] = [];

    for (const item of items) {
      if (item.groupId) {
        const arr = byGroup.get(item.groupId);
        if (arr) {
          arr.push(item);
        } else {
          byGroup.set(item.groupId, [item]);
        }
      } else {
        ungrouped.push(item);
      }
    }
    return { byGroup, ungrouped };
  }, [items]);

  // 当前所有分组 id（用于 toggleGroup 时 GC 残留 id）
  const knownGroupIds = useMemo(
    () => new Set(groups.map((g) => g.id)),
    [groups],
  );

  const handleToggleGroup = (id: string) => {
    void toggleGroup(resourceType, id, knownGroupIds);
  };

  const handleToggleUngrouped = () => {
    void toggleUngrouped(resourceType);
  };

  const reloadItems = async () => {
    switch (resourceType) {
      case "chat": {
        await loadChats();
        await loadAllNodes();
        // 若当前选中的对话已被删除，清空右侧内容
        const chats = useChatStore.getState().chats;
        if (currentChatId && !chats.some((c) => c.id === currentChatId)) {
          await selectChat(null);
        }
        break;
      }
      case "favorite":
        await loadFavorites();
        break;
      case "role":
        await loadRoles();
        break;
    }
  };

  if (items.length === 0 && groups.length === 0) {
    return <>{emptyState}</>;
  }

  // Set 查找 O(1)
  const collapsedSet = useMemo(() => new Set(collapsedIds), [collapsedIds]);

  return (
    <div className="space-y-1">
      {/* 未分组头部：可折叠（持久化） */}
      {grouped.ungrouped.length > 0 && (
        <button
          type="button"
          onClick={handleToggleUngrouped}
          className="flex w-full cursor-pointer items-center gap-2 px-2 py-2 text-left text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-150",
              ungroupedCollapsed && "-rotate-90",
            )}
          />
          <span className="inline-block h-2 w-2 rounded-full border border-muted" />
          未分组 ({grouped.ungrouped.length})
        </button>
      )}

      {/* 未分组条目 */}
      {!ungroupedCollapsed && grouped.ungrouped.length > 0 && (
        <div className="space-y-1">{grouped.ungrouped.map((item) => renderItem(item))}</div>
      )}

      {/* 分组区域 */}
      {groups.map((group) => {
        const groupItems = grouped.byGroup.get(group.id) ?? [];
        // 默认展开；store 中记录的为「已收缩」→ 取反
        const expanded = !collapsedSet.has(group.id);
        return (
          <div key={group.id} className="space-y-1">
            <GroupHeader
              group={group}
              resourceType={resourceType}
              count={groupItems.length}
              expanded={expanded}
              onToggle={() => handleToggleGroup(group.id)}
              onDeleted={reloadItems}
            />
            {expanded && groupItems.length > 0 && (
              <div className="space-y-1">{groupItems.map((item) => renderItem(item))}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
