/**
 * SaveStatusBar（§20）
 *
 * 仅保留保存按钮，两个状态：
 * - 有编辑未保存：亮起（Primary，可点击）
 * - 无编辑/已保存：灰色（disabled，不可点击）
 *
 * 位置：FavoriteDetail 编辑器底部，右对齐。
 */

import { useFavoriteStore } from "@/features/favorite/store";
import { cn } from "@/lib/utils";

export function SaveStatusBar(): React.JSX.Element {
  const isDirty = useFavoriteStore((s) => s.isDirty);
  const manualSave = useFavoriteStore((s) => s.manualSave);

  return (
    <div className="flex items-center justify-end gap-3 border-t border-border bg-background px-6 py-3">
      <button
        type="button"
        onClick={() => void manualSave()}
        disabled={!isDirty}
        className={cn(
          "inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
          isDirty
            ? "bg-primary-strong text-primary-foreground hover:bg-primary-strong/90"
            : "cursor-not-allowed bg-border text-muted",
        )}
      >
        保存
      </button>
    </div>
  );
}
