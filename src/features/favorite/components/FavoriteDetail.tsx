/**
 * FavoriteDetail（§8.3）
 *
 * 详情页：
 * - Title：受控 input，Enter / Blur 实时保存（调 `renameFavorite`）
 * - Editor：受控 textarea，变化时调 `updateContent` 置 `isDirty = true`
 * - 底部：`<SaveStatusBar />`（§20）
 * - **无** Delete 按钮（V5.3 移除：删除入口仅在 FavoriteList hover 区）
 *
 * 自动化保存：`<useFavoriteAutoSave />` 10s 轮询 + 卸载时立即保存。
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Star } from "lucide-react";
import { useFavoriteStore } from "@/features/favorite/store";
import { useFavoriteAutoSave } from "@/features/favorite/hooks/useFavoriteAutoSave";
import { cn } from "@/lib/utils";

import { EmptyState } from "@/components/common/EmptyState";
import { MarkdownRenderer } from "@/components/common/MarkdownRenderer";
import { SaveStatusBar } from "./SaveStatusBar";

export function FavoriteDetail(): React.JSX.Element {
  const currentFavoriteId = useFavoriteStore((s) => s.currentFavoriteId);
  const currentFavorite = useFavoriteStore((s) => s.currentFavorite);
  const renameFavorite = useFavoriteStore((s) => s.renameFavorite);
  const updateContent = useFavoriteStore((s) => s.updateContent);

  // 标题本地草稿（与 §13.4 行内编辑类似，但实时保存）
  const [titleDraft, setTitleDraft] = useState(currentFavorite?.title ?? "");

  useEffect(() => {
    setTitleDraft(currentFavorite?.title ?? "");
  }, [currentFavorite?.id, currentFavorite?.title]);

  // 启动 10s 自动保存 + 卸载时立即保存
  useFavoriteAutoSave();

  if (currentFavorite === null || currentFavoriteId === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={Star}
          title="还未选中任何收藏"
          subtitle="从左侧列表选一个"
        />
      </div>
    );
  }

  const onTitleBlur = () => {
    const next = titleDraft.trim();
    if (next.length === 0 || next === currentFavorite.title) {
      setTitleDraft(currentFavorite.title);
      return;
    }
    void renameFavorite(currentFavorite.id, next);
  };

  const onTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.currentTarget as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setTitleDraft(currentFavorite.title);
      (e.currentTarget as HTMLInputElement).blur();
    }
  };

  const onContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    void updateContent(currentFavorite.id, e.target.value);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Title（受控 input，§8.3） */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={onTitleBlur}
          onKeyDown={onTitleKeyDown}
          placeholder="无标题"
          className={cn(
            "w-full bg-transparent text-lg font-semibold leading-snug text-foreground outline-none",
            "border-0 border-b border-transparent focus:border-primary",
          )}
        />
      </div>

      {/* Editor / Markdown 预览区域 — 可拖动分割 */}
      <SplitEditorPreview
        content={currentFavorite.content}
        onContentChange={onContentChange}
      />

      <SaveStatusBar />
    </div>
  );
}

// =============================================================
// 可拖动分割的编辑/预览区域
// =============================================================

interface SplitEditorPreviewProps {
  content: string;
  onContentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

function SplitEditorPreview({
  content,
  onContentChange,
}: SplitEditorPreviewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editorRatio, setEditorRatio] = useState(0.5);
  const isDragging = useRef(false);

  const MIN_RATIO = 0.2; // 最小高度 = 整体高度的 1/5

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  const stopDrag = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const ratio = Math.max(MIN_RATIO, Math.min(1 - MIN_RATIO, y / rect.height));
      setEditorRatio(ratio);
    },
    [],
  );

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDrag);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopDrag);
    };
  }, [onMouseMove, stopDrag]);

  const editorHeight = `calc(${editorRatio * 100}% - 8px)`;
  const previewHeight = `calc(${(1 - editorRatio) * 100}% - 8px)`;

  return (
    <div ref={containerRef} className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* 编辑区 */}
      <div
        className="scroll-area overflow-y-auto px-6 py-2"
        style={{ height: editorHeight, minHeight: `${MIN_RATIO * 100}%` }}
      >
        <textarea
          value={content}
          onChange={onContentChange}
          placeholder="开始记录你的想法…"
          className={cn(
            "h-full w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none",
            "placeholder:text-muted",
          )}
        />
      </div>

      {/* 拖动分割线 */}
      <div
        className="shrink-0 h-4 flex items-center justify-center cursor-row-resize bg-background border-y border-border hover:bg-primary-hover transition-colors"
        onMouseDown={startDrag}
        title="拖动调整编辑区和预览区高度"
      >
        <div className="w-8 h-1 rounded-full bg-muted pointer-events-none" />
      </div>

      {/* Markdown 预览区 */}
      <div
        className="scroll-area overflow-y-auto px-6 py-2"
        style={{ height: previewHeight, minHeight: `${MIN_RATIO * 100}%` }}
      >
        <p className="mb-2 text-xs font-medium text-muted">预览</p>
        <MarkdownRenderer content={content || "*暂无内容*"} />
      </div>
    </div>
  );
}

// 留个 import 引用避免 lint "no-unused-vars" 警告（cn 实际有使用）
void cn;
