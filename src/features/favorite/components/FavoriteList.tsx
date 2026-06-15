/**
 * FavoriteList（§8.3 + §13）
 *
 * 列表容器：调 `favoriteStore.loadFavorites()` 拉数据，渲染 `<FavoriteItem />`。
 * - 加载/错误/空 三态分支
 * - 空态："还没有收藏 / 从对话中点击 Star 即可"
 *
 * 集成位置：`ListPanel`（当 `appStore.view === 'favorite'` 时挂载）。
 */

import { useEffect } from "react";
import { Star } from "lucide-react";

import { useFavoriteStore } from "@/features/favorite/store";

import { EmptyState } from "@/components/common/EmptyState";
import { FavoriteItem } from "./FavoriteItem";

export function FavoriteList(): React.JSX.Element {
  const favorites = useFavoriteStore((s) => s.favorites);
  const status = useFavoriteStore((s) => s.status);
  const loadFavorites = useFavoriteStore((s) => s.loadFavorites);

  useEffect(() => {
    if (status === "empty") {
      void loadFavorites();
    }
  }, [status, loadFavorites]);

  if (status === "loading" && favorites.length === 0) {
    return <div className="p-4 text-xs text-muted">加载中…</div>;
  }

  if (status === "error") {
    return (
      <EmptyState
        icon={Star}
        title="加载失败"
        subtitle="请检查网络或重启应用"
      />
    );
  }

  if (favorites.length === 0) {
    // §18.2 Favorite（无收藏）空态
    return (
      <EmptyState
        icon={Star}
        title="还没有收藏"
        subtitle="在 AI 回复旁点击收藏图标，内容会出现在这里"
      />
    );
  }

  return (
    <ul className="flex flex-col gap-1 py-1 list-none p-0 m-0">
      {favorites.map((f) => (
        <FavoriteItem key={f.id} favorite={f} />
      ))}
    </ul>
  );
}
