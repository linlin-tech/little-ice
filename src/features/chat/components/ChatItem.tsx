/**
 * ChatItem（§13）
 *
 * 单个 chat 列表项：
 * - 容器：`p-3 rounded-md mx-2 cursor-pointer` + hover `bg-primary-hover` + selected `bg-primary-soft`
 * - 内容（§13.2）：单行省略号的 Title + 灰色 meta 时间
 * - Hover 时淡入（150ms）「…」菜单按钮
 * - 菜单项：模型角色 ▶（二级菜单）/ 编辑 / 删除
 * - 编辑：行内编辑 title
 * - 删除：confirmDestructive → deleteChat
 *
 * 「…」菜单弹出层使用 React Portal 渲染到 document.body：
 * - ListPanel 是 CSS Grid 的一列 + z-10，且其内部列表区有 `overflow-y-auto`
 *   滚动容器 + 右侧 ContentPanel 在同一 grid 行中后置；
 * - 二级菜单「模型角色 ▶」需要从主菜单右侧延伸进入 ContentPanel 区域；
 *   若用普通 `absolute` 定位，会被 ListPanel 自身 z-index 与 ContentPanel 的
 *   后置层叠顺序覆盖（视觉上"被对话区盖住"）。
 * - 用 `createPortal` + `position: fixed`，并按触发按钮的 `getBoundingClientRect()`
 *   计算坐标，让菜单脱离父级 stacking context / overflow 边界，浮在 ContentPanel 之上。
 */

import { MoreHorizontal, Pencil, Trash2, Check, UserCog } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useChatStore } from "@/features/chat/store";
import { useTreeViewStore } from "@/features/tree/store";
import { useRoleStore } from "@/features/role/store";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Chat, Role } from "@/types/models";


interface MenuPosition {
  top: number;
  right: number;
}

interface SubmenuPosition {
  top: number;
  left: number;
}

const MENU_OFFSET = 4; // mt-1 = 4px

interface ChatItemProps {
  chat: Chat;
}

export function ChatItem({ chat }: ChatItemProps): React.JSX.Element {
  const selectedChatId = useChatStore((s) => s.currentChatId);
  const selectChat = useChatStore((s) => s.selectChat);
  const renameChat = useChatStore((s) => s.renameChat);
  const setChatRole = useChatStore((s) => s.setChatRole);

  const roles = useRoleStore((s) => s.roles);

  const selected = selectedChatId === chat.id;

  // 行内编辑态
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(chat.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // 菜单状态
  const [menuOpen, setMenuOpen] = useState(false);
  const [roleSubOpen, setRoleSubOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<SubmenuPosition | null>(
    null,
  );

  // Refs（用于 click-outside 判定 + 计算菜单位置）
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

  // 点击外部关闭菜单（mousedown 监听；需覆盖 portal 出去的菜单）
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

  // 滚动 / 窗口大小变化：关闭菜单，避免 fixed 定位与触发按钮错位
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => {
      setMenuOpen(false);
      setRoleSubOpen(false);
    };
    window.addEventListener("resize", close);
    // capture: true 在捕获阶段触发，覆盖嵌套滚动容器（ListPanel 内的滚动列表）
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuOpen]);

  // ESC 关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setRoleSubOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
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
    // 同步 treeViewStore（保持树图缓存一致）
    await useTreeViewStore.getState().renameNode(chat.id, next);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftTitle(chat.title);
  };

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    // 走 treeViewStore 的删除确认对话框（递归删除子树 + 关联对话）
    useTreeViewStore.getState().requestDelete(chat.id);
  };

  const onSetRole = async (role: Role) => {
    await setChatRole(chat.id, role.id);
    // 同步 treeViewStore
    await useTreeViewStore.getState().setNodeRole(chat.id, role.id);
    setMenuOpen(false);
    setRoleSubOpen(false);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpen) {
      // 关闭
      setMenuOpen(false);
      setRoleSubOpen(false);
      setMenuPosition(null);
      setSubmenuPosition(null);
      return;
    }
    // 打开：按触发按钮的位置计算主菜单位置（viewport 坐标）
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
    // 二级菜单位置：紧贴主菜单右侧
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
        "group relative mx-2 cursor-pointer rounded-md px-4 py-3 text-sm transition-colors",
        selected
          ? "border-l-[3px] border-primary bg-primary-soft"
          : "border-l-[3px] border-transparent hover:bg-primary-hover",
      )}
    >
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
        <div className="truncate pr-[76px] text-sm font-medium text-foreground">
          {chat.title}
        </div>
      )}

      <div className="mt-1 text-xs text-muted">
        {formatRelativeTime(chat.updatedAt)}
      </div>

      {/* hover 才显示的「…」菜单按钮（§13.3） */}
      {!editing && (
        <div
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
            selected && "opacity-100",
          )}
        >
          <button
            ref={menuButtonRef}
            type="button"
            aria-label="更多操作"
            onClick={toggleMenu}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 主菜单（§12.7）— Portal 到 body，避免被右侧 ContentPanel 覆盖 */}
      {menuOpen &&
        menuPosition &&
        createPortal(
          <div
            ref={mainMenuRef}
            style={{
              position: "fixed",
              top: menuPosition.top,
              right: menuPosition.right,
            }}
            className="z-50 w-40 rounded-md border border-border bg-background py-1 shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 模型角色二级菜单入口 */}
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
              onClick={onDelete}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-primary-hover hover:text-error"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted" />
              删除
            </button>
          </div>,
          document.body,
        )}

      {/* 二级菜单（角色切换子菜单）— Portal 到 body，浮在 ContentPanel 之上 */}
      {roleSubOpen &&
        submenuPosition &&
        createPortal(
          <div
            ref={submenuRef}
            style={{
              position: "fixed",
              top: submenuPosition.top,
              left: submenuPosition.left,
            }}
            className="z-50 min-w-[140px] rounded-md border border-border bg-background py-1 shadow-md"
            onMouseEnter={() => setRoleSubOpen(true)}
            onMouseLeave={() => setRoleSubOpen(false)}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 系统永远至少有「默认助手」内置角色（DB migration 保证），
                此处不渲染空态文案；App.tsx 启动时已 loadRoles()。 */}
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
                  role.id === chat.roleId
                    ? "text-primary-strong"
                    : "text-foreground",
                )}
              >
                <span>{role.name}</span>
                {role.id === chat.roleId && (
                  <Check className="h-3.5 w-3.5" />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </li>
  );
}
