/**
 * RoleItem
 *
 * 单个 role 列表项，视觉对齐截图风格：
 * - 左侧：机器人图标（浅蓝底圆形）
 * - 中部：角色名称
 * - 右侧：「⋮」更多菜单（移动到分组 / 移出分组 / 删除）
 */

import {
  MoreVertical,
  Trash2,
  FolderOpen,
  FolderMinus,
  Bot,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useGroupStore } from "@/features/group/store";
import { useRoleStore } from "@/features/role/store";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/models";

import { confirmDestructive } from "@/components/common/ConfirmDialog";
import { pickGroup } from "@/components/common/GroupPickerDialog";

interface RoleItemProps {
  role: Role;
}

export function RoleItem({ role }: RoleItemProps): React.JSX.Element {
  const selectedRoleId = useRoleStore((s) => s.selectedRoleId);
  const selectRole = useRoleStore((s) => s.selectRole);
  const deleteRole = useRoleStore((s) => s.deleteRole);
  const loadRoles = useRoleStore((s) => s.loadRoles);

  const selected = selectedRoleId === role.id;

  const moveItemToGroup = useGroupStore((s) => s.moveItemToGroup);
  const moveItemOutOfGroup = useGroupStore((s) => s.moveItemOutOfGroup);

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

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    const ok = await confirmDestructive(
      role.isBuiltin ? "系统内置角色不可删除" : `要删除角色「${role.name}」吗？`,
    );
    if (ok && !role.isBuiltin) await deleteRole(role.id);
  };

  const handleMoveToGroup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    const target = await pickGroup("role", role.groupId);
    if (!target) return;
    await moveItemToGroup("role", role.id, target.id);
    await loadRoles();
  };

  const handleMoveOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    void moveItemOutOfGroup("role", role.id).then(() => {
      void loadRoles();
    });
  };

  return (
    <li
      onClick={() => selectRole(role.id)}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 transition-colors",
        selected ? "bg-primary-soft" : "hover:bg-primary-hover",
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
        <Bot className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{role.name}</div>
      </div>

      {!role.isBuiltin && (
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="更多操作"
          onClick={toggleMenu}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      )}

      {menuOpen && menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
            className="z-50 w-44 rounded-xl border border-border bg-background py-1 shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleMoveToGroup}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-primary-hover"
            >
              <FolderOpen className="h-3.5 w-3.5 text-muted" />
              移动到分组
            </button>
            {role.groupId && (
              <button
                type="button"
                onClick={handleMoveOut}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-primary-hover"
              >
                <FolderMinus className="h-3.5 w-3.5 text-muted" />
                移出分组
              </button>
            )}
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={onDelete}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-primary-hover hover:text-error"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted" />
              删除
            </button>
          </div>,
          document.body,
        )}
    </li>
  );
}
