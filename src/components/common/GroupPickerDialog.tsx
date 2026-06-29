/**
 * GroupPickerDialog
 *
 * 全局单例的分组选择弹窗，采用「输入过滤 + 下拉列表」的 Combobox 交互。
 * 用于「移动到分组」场景，替代原生 window.prompt。
 *
 * 用法：
 * ```ts
 * const group = await pickGroup("chat", chat.groupId);
 * if (group) {
 *   await moveItemToGroup("chat", chat.id, group.id);
 * }
 * ```
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Folder, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useGroupStore } from "@/features/group/store";
import type { Group, ResourceType } from "@/types/models";

// =============================================================
// 全局状态管理（单例模式）
// =============================================================

interface PendingPick {
  resourceType: ResourceType;
  currentGroupId: string | null;
  resolve: (group: Group | null) => void;
}

let pendingPick: PendingPick | null = null;
let notifyOpen: (() => void) | null = null;

function setPendingPick(p: PendingPick | null) {
  pendingPick = p;
  notifyOpen?.();
}

function getPendingPick(): PendingPick | null {
  return pendingPick;
}

// =============================================================
// pickGroup：返回 Promise<Group | null>
// =============================================================

/**
 * 弹出分组选择器。返回用户选中的 Group，取消或选中原分组时返回 `null`。
 *
 * @param resourceType     资源类型
 * @param currentGroupId   当前所在分组 id（用于高亮/跳过）
 */
export async function pickGroup(
  resourceType: ResourceType,
  currentGroupId: string | null = null,
): Promise<Group | null> {
  return new Promise((resolve) => {
    setPendingPick({ resourceType, currentGroupId, resolve });
  });
}

// =============================================================
// GroupPickerDialog 组件（全局单例，在 App 顶层挂载一次）
// =============================================================

export function GroupPickerDialog(): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [resourceType, setResourceType] = useState<ResourceType>("chat");
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useGroupStore((s) => s.groupsByType[resourceType]);
  const loadGroups = useGroupStore((s) => s.loadGroups);

  // 注册打开通知
  useState(() => {
    notifyOpen = () => {
      const pending = getPendingPick();
      if (pending) {
        setResourceType(pending.resourceType);
        setCurrentGroupId(pending.currentGroupId);
        setFilter("");
        setActiveIndex(0);
        setOpen(true);
      }
    };
    return () => {
      notifyOpen = null;
    };
  });

  // 打开时加载最新分组列表
  useEffect(() => {
    if (open) {
      void loadGroups(resourceType);
    }
  }, [open, resourceType, loadGroups]);

  // 聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filteredGroups = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(keyword));
  }, [groups, filter]);

  // 过滤变化时重置高亮
  useEffect(() => {
    setActiveIndex(0);
  }, [filter]);

  const handleClose = useCallback((group: Group | null) => {
    const pending = getPendingPick();
    if (pending) {
      pending.resolve(group);
      setPendingPick(null);
    }
    setOpen(false);
    setFilter("");
    setActiveIndex(0);
  }, []);

  const onSelect = useCallback(
    (group: Group) => {
      if (group.id === currentGroupId) {
        handleClose(null);
        return;
      }
      handleClose(group);
    },
    [currentGroupId, handleClose],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(filteredGroups.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const group = filteredGroups[activeIndex];
        if (group) {
          onSelect(group);
        }
      } else if (e.key === "Escape") {
        handleClose(null);
      }
    },
    [activeIndex, filteredGroups, handleClose, onSelect],
  );

  // 高亮项滚动到可视区域
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[activeIndex] as HTMLElement | undefined;
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && handleClose(null)}>
      <DialogPrimitive.Portal>
        {/* 遮罩 */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />

        {/* 对话框内容 */}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-[420px] translate-x-[-50%] translate-y-[-50%] rounded-lg bg-background p-0 shadow-lg",
          )}
          onPointerDownOutside={() => handleClose(null)}
          onEscapeKeyDown={() => handleClose(null)}
        >
          <div className="p-6 pb-0">
            {/* 标题 */}
            <DialogPrimitive.Title className="text-base font-semibold text-foreground">
              移动到分组
            </DialogPrimitive.Title>

            {/* 关闭按钮 */}
            <DialogPrimitive.Close
              className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-primary-hover"
              onClick={() => handleClose(null)}
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>

            {/* 过滤输入框 */}
            <div className="mt-4">
              <input
                ref={inputRef}
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="输入分组名称过滤..."
                className={cn(
                  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted",
                  "focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong",
                )}
              />
            </div>
          </div>

          {/* 分组列表 */}
          <div className="mx-6 my-3 max-h-[260px] overflow-y-auto rounded-md border border-border">
            {filteredGroups.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted">
                {groups.length === 0 ? "暂无可选分组" : "没有匹配的分组"}
              </div>
            ) : (
              filteredGroups.map((group, index) => {
                const isCurrent = group.id === currentGroupId;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => onSelect(group)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                      index === activeIndex ? "bg-primary-soft" : "hover:bg-primary-hover",
                      isCurrent ? "text-muted" : "text-foreground",
                    )}
                  >
                    <Folder className="h-4 w-4 shrink-0 text-primary-strong" />
                    <span className="flex-1 truncate">{group.name}</span>
                    {isCurrent && (
                      <span className="shrink-0 text-xs text-muted">当前</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* 底部按钮 */}
          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={() => handleClose(null)}
              className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted transition-colors hover:bg-primary-hover"
            >
              取消
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
