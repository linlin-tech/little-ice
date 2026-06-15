/**
 * useFavoriteAutoSave（§7.1 + §6.5）
 *
 * 10s 轮询 + 卸载时立即保存：
 * - 每 10s 检查 `isDirty && !isSaving`，有则 `manualSave()`
 * - 卸载时若 `isDirty`，立即同步调一次 `manualSave()`
 * - 切 favorite（`currentFavoriteId` 变化）也会重新挂 effect —— 但 `manualSave` 内部
 *   已经有 `isDirty` 检查，所以重复触发是幂等的
 *
 * ## 调用位置
 * 应在 `<FavoriteDetail />` 顶层调用一次（hook 通过 useEffect 启动 timer）。
 */

import { useEffect } from "react";

import { useFavoriteStore } from "@/features/favorite/store";

const AUTO_SAVE_INTERVAL_MS = 10_000;

export function useFavoriteAutoSave(): void {
  const currentFavoriteId = useFavoriteStore((s) => s.currentFavoriteId);
  const isDirty = useFavoriteStore((s) => s.isDirty);
  const isSaving = useFavoriteStore((s) => s.isSaving);
  const manualSave = useFavoriteStore((s) => s.manualSave);

  useEffect(() => {
    // 没选中 favorite → 不挂 timer
    if (currentFavoriteId === null) return;

    const timer = setInterval(() => {
      // 每次重新从 store 拿最新值（避免闭包捕获 stale 状态）
      const s = useFavoriteStore.getState();
      if (s.isDirty && !s.isSaving) {
        void s.manualSave();
      }
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [currentFavoriteId, isDirty, isSaving, manualSave]);

  // 卸载时：若 isDirty，立即同步触发一次保存
  useEffect(() => {
    return () => {
      const s = useFavoriteStore.getState();
      if (s.isDirty && !s.isSaving && s.currentFavoriteId !== null) {
        // 注意：effect cleanup 是同步的，但 manualSave 是 async
        // 用 .catch 静默吞错（不阻塞 unmount）
        s.manualSave().catch(() => {
          /* noop */
        });
      }
    };
  }, []);
}
