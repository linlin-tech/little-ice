/**
 * ChatItem（§13）
 *
 * 单个 chat 列表项：
 * - 容器：`p-3 rounded-md mx-2 cursor-pointer` + hover `bg-primary-hover` + selected `bg-primary-soft`
 * - 内容（§13.2）：单行省略号的 Title + 灰色 meta 时间
 * - Hover 时淡入（150ms）Edit + Delete 两个 IconButton
 * - 点击 Edit 进入行内编辑态（§13.4）：input 替换 title，下划线提示
 *   - Enter / Blur → 调 `renameChat` + 退编辑
 *   - Esc → 退编辑（不保存）
 * - 点击 Delete → `confirmDestructive` → 调 `deleteChat`
 */

import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useChatStore } from "@/features/chat/store";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Chat } from "@/types/models";

import { confirmDestructive } from "@/components/common/ConfirmDialog";

interface ChatItemProps {
  chat: Chat;
}

export function ChatItem({ chat }: ChatItemProps): React.JSX.Element {
  const selectedChatId = useChatStore((s) => s.currentChatId);
  const selectChat = useChatStore((s) => s.selectChat);
  const renameChat = useChatStore((s) => s.renameChat);
  const deleteChat = useChatStore((s) => s.deleteChat);

  const selected = selectedChatId === chat.id;

  // 行内编辑态
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(chat.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // chat.title 变化时同步（避免重命名后旧值"复活"）
  useEffect(() => {
    if (!editing) setDraftTitle(chat.title);
  }, [chat.title, editing]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraftTitle(chat.title);
    setEditing(true);
  };

  const commitEdit = async () => {
    const next = draftTitle.trim();
    setEditing(false);
    if (next.length === 0 || next === chat.title) {
      setDraftTitle(chat.title);
      return;
    }
    await renameChat(chat.id, next);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftTitle(chat.title);
  };

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirmDestructive(
      `要删除该对话吗？`,
    );
    if (ok) await deleteChat(chat.id);
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
          // §13.4 行内编辑：宽度 100% / 14px / 500 / 蓝色下划线
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

      {/* hover 才显示的操作图标（§13.3，V1.2 双图标） */}
      {!editing && (
        <div
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
            // 选中态常显（让用户在已选中项上仍能点 Delete）
            selected && "opacity-100",
          )}
        >
          <IconBtn ariaLabel="编辑" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn ariaLabel="删除" onClick={onDelete} danger>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      )}
    </li>
  );
}

// =============================================================
// IconButton：hover 操作按钮（§12.6，List Item 内嵌）
// =============================================================

interface IconBtnProps {
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}

function IconBtn({
  onClick,
  danger,
  ariaLabel,
  children,
}: IconBtnProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        "text-muted hover:bg-background",
        danger && "hover:text-error",
      )}
    >
      {children}
    </button>
  );
}
