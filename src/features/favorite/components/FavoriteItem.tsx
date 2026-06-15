/**
 * FavoriteItem（§13 + §8.3）
 *
 * 单个 favorite 列表项：
 * - 容器：p-3 rounded-md mx-2 cursor-pointer + hover bg-primary-hover + selected bg-primary-soft
 * - Title + 灰色 meta 时间
 * - Hover 时淡入 Edit + Delete（V5.3：双图标）
 * - Edit：行内编辑态，Enter/Blur → renameFavorite；Esc 取消
 * - Delete：confirmDestructive → deleteFavorite
 *
 * 与 ChatItem 视觉风格一致（§13.1/13.2/13.3），便于 UI 一致性。
 */

import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useFavoriteStore } from "@/features/favorite/store";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Favorite } from "@/types/models";

import { confirmDestructive } from "@/components/common/ConfirmDialog";

interface FavoriteItemProps {
  favorite: Favorite;
}

export function FavoriteItem({
  favorite,
}: FavoriteItemProps): React.JSX.Element {
  const currentFavoriteId = useFavoriteStore((s) => s.currentFavoriteId);
  const selectFavorite = useFavoriteStore((s) => s.selectFavorite);
  const renameFavorite = useFavoriteStore((s) => s.renameFavorite);
  const deleteFavorite = useFavoriteStore((s) => s.deleteFavorite);

  const selected = currentFavoriteId === favorite.id;

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(favorite.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraftTitle(favorite.title);
  }, [favorite.title, editing]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraftTitle(favorite.title);
    setEditing(true);
  };

  const commitEdit = async () => {
    const next = draftTitle.trim();
    setEditing(false);
    if (next.length === 0 || next === favorite.title) {
      setDraftTitle(favorite.title);
      return;
    }
    await renameFavorite(favorite.id, next);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftTitle(favorite.title);
  };

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirmDestructive(
      "要删除该收藏吗？",
    );
    if (ok) await deleteFavorite(favorite.id);
  };

  return (
    <li
      onClick={() => void selectFavorite(favorite.id)}
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
          {favorite.title}
        </div>
      )}

      <div className="mt-1 text-xs text-muted">
        {formatRelativeTime(favorite.updatedAt)}
      </div>

      {!editing && (
        <div
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
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
