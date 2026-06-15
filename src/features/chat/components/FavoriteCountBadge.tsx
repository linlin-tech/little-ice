/**
 * FavoriteCountBadge（§14.0 右侧徽章）
 *
 * Chat 头部右侧"⭐ N"徽章（V1.4 重新启用）。
 * - N = `chatStore.favoriteCount`，N = 0 时**也显示**（位置稳定）
 * - N > 99 → 显示 `99+`
 * - MVP 不响应点击
 */

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface FavoriteCountBadgeProps {
  count: number;
}

export function FavoriteCountBadge({
  count,
}: FavoriteCountBadgeProps): React.JSX.Element {
  const display = count > 99 ? "99+" : String(count);
  const hasFavorites = count > 0;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        hasFavorites
          ? "bg-primary-soft text-primary-strong"
          : "bg-transparent text-muted",
      )}
      aria-label={hasFavorites ? `已被收藏 ${count} 次` : "暂无收藏"}
    >
      <Star
        className="h-3 w-3"
        fill={hasFavorites ? "currentColor" : "none"}
        aria-hidden="true"
      />
      <span>{display}</span>
    </span>
  );
}
