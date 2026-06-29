/**
 * GroupHeader
 *
 * 分组头部：箭头、文件夹图标、名称、计数、更多操作。
 * - 点击头部展开/折叠
 * - 点击「···」弹出菜单：重命名 / 删除分组
 *
 * 视觉对齐截图：浅灰文字计数、右侧更多按钮、无强烈背景色。
 */

import { ChevronDown, FolderOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useGroupStore } from "@/features/group/store";
import { cn } from "@/lib/utils";
import { promptInput } from "@/components/common/PromptDialog";
import { confirmDestructive } from "@/components/common/ConfirmDialog";
import type { Group, ResourceType } from "@/types/models";

interface GroupHeaderProps {
  group: Group;
  resourceType: ResourceType;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onDeleted?: () => void;
}

export function GroupHeader({
  group,
  resourceType,
  count,
  expanded,
  onToggle,
  onDeleted,
}: GroupHeaderProps): React.JSX.Element {
  const renameGroup = useGroupStore((s) => s.renameGroup);
  const deleteGroup = useGroupStore((s) => s.deleteGroup);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuButtonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [menuOpen]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setMenuOpen(true);
  };

  const handleRename = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    const name = await promptInput("重命名分组", group.name);
    if (name) {
      void renameGroup(resourceType, group.id, name);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    const ok = await confirmDestructive(
      `删除分组「${group.name}」？其中的条目将一并删除，此操作不可撤销。`,
    );
    if (ok) {
      await deleteGroup(resourceType, group.id);
      onDeleted?.();
    }
  };

  return (
    <div
      onClick={onToggle}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2.5 transition-colors",
        "hover:bg-primary-hover",
      )}
    >
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-muted transition-transform duration-150",
          !expanded && "-rotate-90",
        )}
      />
      <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
      <span className="flex-1 truncate text-[15px] font-medium text-foreground">
        {group.name}
        <span className="text-muted"> ({count})</span>
      </span>
      <button
        ref={menuButtonRef}
        type="button"
        onClick={toggleMenu}
        aria-label="分组操作"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-foreground"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {menuOpen && menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
            className="z-50 w-40 rounded-xl border border-border bg-background py-1 shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleRename}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-primary-hover"
            >
              <Pencil className="h-3.5 w-3.5 text-muted" />
              重命名
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-primary-hover hover:text-error"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted" />
              删除分组
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
