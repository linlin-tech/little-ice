/**
 * FavoriteItem
 *
 * 单个 favorite 列表项，视觉对齐截图风格：
 * - 左侧：星标图标（浅蓝底圆形）
 * - 中部：标题 + 灰色 meta 时间
 * - 右侧：「⋮」更多菜单（编辑 / 移动到分组 / 移出分组 / 删除）
 */

import {
  Pencil,
  Trash2,
  MoreVertical,
  FolderOpen,
  FolderMinus,
  Star,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useFavoriteStore } from "@/features/favorite/store";
import { useGroupStore } from "@/features/group/store";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Favorite } from "@/types/models";

import { confirmDestructive } from "@/components/common/ConfirmDialog";
import { pickGroup } from "@/components/common/GroupPickerDialog";

interface FavoriteItemProps {
  favorite: Favorite;
}

export function FavoriteItem({ favorite }: FavoriteItemProps): React.JSX.Element {
  const currentFavoriteId = useFavoriteStore((s) => s.currentFavoriteId);
  const selectFavorite = useFavoriteStore((s) => s.selectFavorite);
  const renameFavorite = useFavoriteStore((s) => s.renameFavorite);
  const deleteFavorite = useFavoriteStore((s) => s.deleteFavorite);
  const loadFavorites = useFavoriteStore((s) => s.loadFavorites);

  const moveItemToGroup = useGroupStore((s) => s.moveItemToGroup);
  const moveItemOutOfGroup = useGroupStore((s) => s.moveItemOutOfGroup);

  const selected = currentFavoriteId === favorite.id;

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(favorite.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraftTitle(favorite.title);
  }, [favorite.title, editing]);

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

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraftTitle(favorite.title);
    setEditing(true);
    setMenuOpen(false);
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
    setMenuOpen(false);
    const ok = await confirmDestructive("要删除该收藏吗？");
    if (ok) await deleteFavorite(favorite.id);
  };

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

  const handleMoveToGroup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    const target = await pickGroup("favorite", favorite.groupId);
    if (!target) return;
    await moveItemToGroup("favorite", favorite.id, target.id);
    await loadFavorites();
  };

  const handleMoveOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    void moveItemOutOfGroup("favorite", favorite.id).then(() => {
      void loadFavorites();
    });
  };

  return (
    <li
      onClick={() => void selectFavorite(favorite.id)}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 transition-colors",
        selected ? "bg-primary-soft" : "hover:bg-primary-hover",
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
        <Star className="h-5 w-5" />
      </div>

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
            <div className="truncate text-sm font-medium text-foreground">{favorite.title}</div>
            <div className="mt-0.5 text-xs text-muted">
              {formatRelativeTime(favorite.updatedAt)} · AI
            </div>
          </>
        )}
      </div>

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
            {favorite.groupId && (
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
