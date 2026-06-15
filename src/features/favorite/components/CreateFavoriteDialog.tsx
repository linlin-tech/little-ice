/**
 * CreateFavoriteDialog
 *
 * 创建 Favorite 的标题输入 Dialog（任务要求）。
 *
 * 用法（从 AI 消息的 Favorite 按钮调用）：
 * ```ts
 * import { useCreateFavorite } from "@/features/favorite/components/CreateFavoriteDialog";
 *
 * const createFavorite = useCreateFavorite();
 * createFavorite({ sourceContent: aiMessage.content, sourceChatId: aiMessage.chatId });
 * ```
 *
 * ## UI 规则
 * - 居中遮罩 + 卡片（`bg-background rounded-lg shadow-md`，参照 §16.2 Dialog 规格）
 * - 标题"收藏"（16px / 600）
 * - input 标题（自动填默认 `sourceContent` 第一行前 30 字）
 * - 按钮：取消（Ghost） / 收藏（Primary）
 * - Esc 关闭；Enter 提交
 *
 * ## 状态
 * 单一全局对话框（用 zustand store 管理 open/title）。
 * 打开时聚焦 input。
 */

import { Loader2, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useFavoriteStore } from "@/features/favorite/store";
import { useChatStore } from "@/features/chat/store";
import { truncate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Id } from "@/types/models";

// =============================================================
// 全局单例 store
// =============================================================

interface PendingCreate {
  /** 预填的标题（默认 = sourceContent 第一行前 30 字） */
  defaultTitle: string;
  /** AI 消息原始内容 */
  sourceContent: string;
  /** 来源 chat id（用于后续 chat header 徽章刷新） */
  sourceChatId: Id;
  /** 来源 message id（用于判断消息是否已被收藏） */
  sourceMessageId: Id;
  // 收藏成功后回调（供外部更新收藏状态）
  onFavoriteCreated?: (favoriteId: string) => void;
}

interface DialogState {
  pending: PendingCreate | null;
  open: (p: PendingCreate) => void;
  close: () => void;
  onFavoriteCreated?: (favoriteId: string) => void;
}

const DialogContext = createContext<DialogState | null>(null);

/**
 * 在 App 顶层挂一次，提供全局单例 Dialog。
 * - `<CreateFavoriteProvider>` 应在 `<AppShell />` 之外或之内都可
 * - `<CreateFavoriteDialog />` 在 Provider 内渲染一次
 */
export function CreateFavoriteProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [pending, setPending] = useState<PendingCreate | null>(null);

  const open = useCallback((p: PendingCreate) => setPending(p), []);
  const close = useCallback(() => setPending(null), []);

  const ctx = useMemo<DialogState>(
    () => ({ pending, open, close }),
    [pending, open, close],
  );

  return (
    <DialogContext.Provider value={ctx}>
      {children}
      <CreateFavoriteDialog />
    </DialogContext.Provider>
  );
}

export function useCreateFavorite(): (input: {
  sourceContent: string;
  sourceChatId: Id;
  sourceMessageId: Id;
  /** 收藏成功后的回调，用于更新消息收藏状态 */
  onCreated?: (favoriteId: string) => void;
}) => void {
  const ctx = useContext(DialogContext);
  if (ctx === null) {
    throw new Error(
      "useCreateFavorite 必须在 <CreateFavoriteProvider> 内使用",
    );
  }
  return (input) => {
    const defaultTitle = truncate(
      input.sourceContent.split("\n", 1)[0] ?? "AI 回复",
      30,
    );
    ctx.open({
      defaultTitle,
      sourceContent: input.sourceContent,
      sourceChatId: input.sourceChatId,
      sourceMessageId: input.sourceMessageId,
      onFavoriteCreated: input.onCreated,
    });
  };
}

// =============================================================
// Dialog 视图
// =============================================================

function CreateFavoriteDialog(): React.JSX.Element | null {
  const ctx = useContext(DialogContext);
  const createFavorite = useFavoriteStore((s) => s.createFavorite);
  const loadFavoriteCount = useChatStore((s) => s.loadFavoriteCount);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 打开时同步 defaultTitle + 聚焦
  useEffect(() => {
    if (ctx?.pending !== null && ctx?.pending !== undefined) {
      setTitle(ctx.pending.defaultTitle);
      setBusy(false);
      // 下一帧聚焦（避免 input 还未挂载）
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [ctx?.pending]);

  if (ctx === null || ctx.pending === null) return null;
  const pending = ctx.pending; // 锁定 non-null 给后续函数闭包

  const close = () => {
    if (!busy) ctx.close();
  };

  const onConfirm = async () => {
    if (busy) return;
    const finalTitle = title.trim().length === 0 ? pending.defaultTitle : title.trim();
    setBusy(true);
    const fav = await createFavorite(
      finalTitle,
      pending.sourceContent,
      pending.sourceChatId,
      pending.sourceMessageId,
    );
    setBusy(false);
    if (fav !== null) {
      // 刷新来源 chat 的收藏数徽章
      void loadFavoriteCount(pending.sourceChatId);
      // 通知外部收藏已创建（用于更新消息收藏状态）
      pending.onFavoriteCreated?.(fav.id);
      ctx.close();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onConfirm();
    }
  };

  return (
    <div
      // 遮罩：全屏 fixed / 半透明黑 / flex 居中
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-fav-title"
    >
      <div
        // §16.2 Dialog：width 420px / padding 24px / rounded-lg (12px) / shadow
        className="w-[420px] rounded-lg bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center justify-between">
          <h2
            id="create-fav-title"
            className="text-base font-semibold text-foreground"
          >
            收藏
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="关闭"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-primary-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-1 text-xs text-muted">
          给这段内容起个标题，方便以后查找
        </p>

        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
          className={cn(
            "mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none",
            "focus:border-primary focus:ring-2 focus:ring-primary/15",
          )}
        />

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted transition-colors hover:bg-primary-hover"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className={cn(
              "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors",
              busy
                ? "cursor-not-allowed bg-border text-muted"
                : "bg-primary-strong text-primary-foreground hover:bg-primary-strong/90",
            )}
          >
            {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
