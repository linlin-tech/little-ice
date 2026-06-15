/**
 * FavoriteToolbar（§8.3）
 *
 * ListPanel 顶部 toolbar，仿照 ChatToolbar。
 * - 左侧：Star 图标 + "收藏" 文字 + 收藏数量徽章
 *
 * 集成位置：`ListPanel`（当 `appStore.view === 'favorite'` 时显示）。
 */

import { Star } from "lucide-react";

import { useFavoriteStore } from "@/features/favorite/store";
import { cn } from "@/lib/utils";

export function FavoriteToolbar(): React.JSX.Element {
  const favorites = useFavoriteStore((s) => s.favorites);
  const hasFavorites = favorites.length > 0;

  return (
    <div className="flex h-12 items-center border-b border-border px-4">
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-muted" />
        <span className="text-sm font-medium text-foreground">收藏</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            hasFavorites
              ? "bg-primary-soft text-primary-strong"
              : "bg-transparent text-muted",
          )}
        >
          {favorites.length}
        </span>
      </div>
    </div>
  );
}
