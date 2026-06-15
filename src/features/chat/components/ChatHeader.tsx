/**
 * ChatHeader（§14.0）
 *
 * 布局：`[话题名称]                          [⭐ N]`
 * 左侧 Title（点击进入重命名态，§13.4 行内编辑）+ 右侧 Favorite Count Badge
 *
 * V1.4 明确：右侧**只显示**徽章，不显示"收藏"图标按钮和"更多"按钮。
 */

import { useEffect, useRef, useState } from "react";

import { useChatStore } from "@/features/chat/store";
import { cn } from "@/lib/utils";

import { FavoriteCountBadge } from "./FavoriteCountBadge";

export function ChatHeader(): React.JSX.Element | null {
  const currentChatId = useChatStore((s) => s.currentChatId);
  const chats = useChatStore((s) => s.chats);
  const favoriteCount = useChatStore((s) => s.favoriteCount);
  const renameChat = useChatStore((s) => s.renameChat);

  const chat = chats.find((c) => c.id === currentChatId) ?? null;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chat?.title ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(chat?.title ?? "");
  }, [chat?.title, editing]);

  if (chat === null) return null;

  const startEdit = () => {
    setDraft(chat.title);
    setEditing(true);
  };

  const commit = async () => {
    const next = draft.trim();
    setEditing(false);
    if (next.length === 0 || next === chat.title) {
      setDraft(chat.title);
      return;
    }
    await renameChat(chat.id, next);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(chat.title);
  };

  return (
    <header
      // §14.0 布局：px-6 py-4 / border-b / flex justify-between
      className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-4"
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          // 复用 §13.4 行内编辑样式（h1 字号 + 蓝色下划线）
          className="min-w-0 flex-1 border-0 border-b border-primary bg-transparent text-lg font-semibold leading-snug text-foreground outline-none"
        />
      ) : (
        <h1
          onClick={startEdit}
          title="点击重命名"
          // §14.0 左侧 Title：15px / 600 / cursor-pointer
          className={cn(
            "min-w-0 flex-1 cursor-pointer truncate text-lg font-semibold text-foreground",
            "hover:text-primary-strong transition-colors",
          )}
        >
          {chat.title}
        </h1>
      )}

      <FavoriteCountBadge count={favoriteCount} />
    </header>
  );
}
