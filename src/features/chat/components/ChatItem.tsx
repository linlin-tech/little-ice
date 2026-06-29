/**
 * ChatItem
 *
 * 单个 chat 列表项，视觉对齐截图/原型：
 * - 左侧：对话气泡图标（浅蓝底圆形）
 * - 中部：标题 + 灰色 meta 时间
 * - 右侧：「⋮」更多菜单（含模型角色 / 编辑 / 移动到分组 / 移出分组 / 删除）
 */

import {
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  UserCog,
  FolderOpen,
  FolderMinus,
  MessageCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useChatStore } from "@/features/chat/store";
import { useGroupStore } from "@/features/group/store";
import { useTreeViewStore } from "@/features/tree/store";
import { useRoleStore } from "@/features/role/store";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { pickGroup } from "@/components/common/GroupPickerDialog";
import { confirmDestructive } from "@/components/common/ConfirmDialog";
import type { Chat, Role } from "@/types/models";

interface MenuPosition {
  top: number;
  right: number;
}

interface SubmenuPosition {
  top: number;
  left: number;
}

const MENU_OFFSET = 4;

interface ChatItemProps {
  chat: Chat;
}

export function ChatItem({ chat }: ChatItemProps): React.JSX.Element {
  const selectedChatId = useChatStore((s) => s.currentChatId);
  const selectChat = useChatStore((s) => s.selectChat);
  const renameChat = useChatStore((s) => s.renameChat);
  const setChatRole = useChatStore((s) => s.setChatRole);
  const loadChats = useChatStore((s) => s.loadChats);

  const moveItemToGroup = useGroupStore((s) => s.moveItemToGroup);
  const moveItemOutOfGroup = useGroupStore((s) => s.moveItemOutOfGroup);

  const roles = useRoleStore((s) => s.roles);

  const selected = selectedChatId === chat.id;

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(chat.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [roleSubOpen, setRoleSubOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<SubmenuPosition | null>(null);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mainMenuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraftTitle(chat.title);
  }, [chat.title, editing]);

  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuButtonRef.current?.contains(target) ||
        mainMenuRef.current?.contains(target) ||
        submenuRef.current?.contains(target)
      ) {
        return;
      }
      setMenuOpen(false);
      setRoleSubOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [menuOpen]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraftTitle(chat.title);
    setEditing(true);
    setMenuOpen(false);
    setRoleSubOpen(false);
  };

  const commitEdit = async () => {
    const next = draftTitle.trim();
    setEditing(false);
    if (next.length === 0 || next === chat.title) {
      setDraftTitle(chat.title);
      return;
    }
    await renameChat(chat.id, next);
    await useTreeViewStore.getState().renameNode(chat.id, next);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftTitle(chat.title);
  };

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    const ok = await confirmDestructive("要删除该对话吗？此操作不可恢复。");
    if (!ok) return;
    await useTreeViewStore.getState().deleteNode(chat.id);
  };

  const onSetRole = async (role: Role) => {
    await setChatRole(chat.id, role.id);
    await useTreeViewStore.getState().setNodeRole(chat.id, role.id);
    setMenuOpen(false);
    setRoleSubOpen(false);
  };

  const handleMoveToGroup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    const target = await pickGroup("chat", chat.groupId);
    if (!target) return;
    await moveItemToGroup("chat", chat.id, target.id);
    await loadChats();
  };

  const handleMoveOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    void moveItemOutOfGroup("chat", chat.id).then(() => {
      void loadChats();
    });
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
      setRoleSubOpen(false);
      setMenuPosition(null);
      setSubmenuPosition(null);
      return;
    }
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPosition({
        top: rect.bottom + MENU_OFFSET,
        right: window.innerWidth - rect.right,
      });
    }
    setMenuOpen(true);
    setRoleSubOpen(false);
  };

  const openSubmenu = () => {
    if (!mainMenuRef.current) return;
    const rect = mainMenuRef.current.getBoundingClientRect();
    setSubmenuPosition({
      top: rect.top,
      left: rect.right + 2,
    });
    setRoleSubOpen(true);
  };

  return (
    <li
      onClick={() => void selectChat(chat.id)}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 transition-colors",
        selected ? "bg-primary-soft" : "hover:bg-primary-hover",
      )}
    >
      {/* 图标 */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
        <MessageCircle className="h-5 w-5" />
      </div>

      {/* 内容 */}
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={() => void commitEdit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commitEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelEdit();
              }
            }}
            className="w-full border-0 border-b border-primary bg-transparent text-sm font-medium leading-snug text-foreground outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <div className="truncate text-sm font-medium text-foreground">{chat.title}</div>
            <div className="mt-0.5 text-xs text-muted">
              {formatRelativeTime(chat.updatedAt)} · AI
            </div>
          </>
        )}
      </div>

      {/* 更多按钮 */}
      {!editing && (
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

      {/* 主菜单 */}
      {menuOpen &&
        menuPosition &&
        createPortal(
          <div
            ref={mainMenuRef}
            style={{ position: "fixed", top: menuPosition.top, right: menuPosition.right }}
            className="z-50 w-40 rounded-xl border border-border bg-background py-1 shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="group/role relative flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm text-foreground hover:bg-primary-hover"
              onMouseEnter={openSubmenu}
              onMouseLeave={() => setRoleSubOpen(false)}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex items-center gap-2">
                <UserCog className="h-3.5 w-3.5 text-muted" />
                模型角色
              </span>
              <span className="text-xs text-muted">▶</span>
            </div>

            <div className="my-1 h-px bg-border" />

            <button
              type="button"
              onClick={startEdit}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-primary-hover"
            >
              <Pencil className="h-3.5 w-3.5 text-muted" />
              编辑
            </button>

            <button
              type="button"
              onClick={handleMoveToGroup}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-primary-hover"
            >
              <FolderOpen className="h-3.5 w-3.5 text-muted" />
              移动到分组
            </button>
            {chat.groupId && (
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

      {/* 二级菜单（角色切换） */}
      {roleSubOpen &&
        submenuPosition &&
        createPortal(
          <div
            ref={submenuRef}
            style={{ position: "fixed", top: submenuPosition.top, left: submenuPosition.left }}
            className="z-50 min-w-[140px] rounded-xl border border-border bg-background py-1 shadow-md"
            onMouseEnter={() => setRoleSubOpen(true)}
            onMouseLeave={() => setRoleSubOpen(false)}
            onClick={(e) => e.stopPropagation()}
          >
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void onSetRole(role);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-primary-hover",
                  role.id === chat.roleId ? "text-primary-strong" : "text-foreground",
                )}
              >
                <span>{role.name}</span>
                {role.id === chat.roleId && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </li>
  );
}
