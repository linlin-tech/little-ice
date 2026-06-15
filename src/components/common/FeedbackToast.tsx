/**
 * FeedbackToast（§17 + §13 状态反馈统一）
 *
 * 集中展示 4 种成功 + 4 种错误的 toast 工厂。
 *
 * ## 4 种成功（§17.1）
 * - `Saved`     "已保存 · 14:23"
 * - `Favorited` "已收藏到 收藏夹"
 * - `Deleted`   "已删除"
 * - `Renamed`   "已重命名"
 *
 * ## 4 种错误（§17.2 + §13 错误体系）
 * - `api_key`     "[api_key] API Key 无效或未配置，请前往设置"
 * - `network`     "[network] 网络连接失败，请重试"
 * - `model`       "[model] 模型服务异常，请稍后重试"
 * - `validation`  "[validation] 输入内容不合法"
 *
 * ## 用法
 * 全局单例（`<FeedbackToastProvider>`）+ `useShowFeedback()` hook。
 *
 * ```ts
 * const show = useShowFeedback();
 * show.success("Saved");
 * show.error("network", "网络连接失败，请重试");
 * ```
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AiErrorType } from "@/types/models";

import { InlineMessage } from "./InlineMessage";

// =============================================================
// 类型
// =============================================================

export type FeedbackKind = "success" | "error";
export type SuccessKind = "Saved" | "Favorited" | "Deleted" | "Renamed";
export type ErrorKind = AiErrorType; // api_key | network | model | timeout | unknown | validation

interface ToastItem {
  id: number;
  kind: FeedbackKind;
  /** 显式文案（若不传则用默认映射） */
  text?: string;
  /** success 时是 SuccessKind，error 时是 ErrorKind */
  payload: SuccessKind | ErrorKind;
}

interface FeedbackContext {
  show: {
    success: (kind: SuccessKind, text?: string) => void;
    error: (kind: ErrorKind, text?: string) => void;
  };
}

const FeedbackContext = createContext<FeedbackContext | null>(null);

// =============================================================
// Provider（挂 App 顶层）
// =============================================================

const AUTO_DISMISS_MS = 2_500;

export function FeedbackToastProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: FeedbackKind, payload: ToastItem["payload"], text?: string) => {
      const id = ++idRef.current;
      setItems((prev) => [...prev, { id, kind, payload, text }]);
      // 自动消失
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const ctx = useMemo<FeedbackContext>(
    () => ({
      show: {
        success: (kind, text) => push("success", kind, text),
        error: (kind, text) => push("error", kind, text),
      },
    }),
    [push],
  );

  return (
    <FeedbackContext.Provider value={ctx}>
      {children}
      <ToastContainer items={items} dismiss={dismiss} />
    </FeedbackContext.Provider>
  );
}

export function useShowFeedback(): FeedbackContext["show"] {
  const ctx = useContext(FeedbackContext);
  if (ctx === null) {
    throw new Error("useShowFeedback 必须在 <FeedbackToastProvider> 内使用");
  }
  return ctx.show;
}

// =============================================================
// Toast 容器（fixed 右上）
// =============================================================

function ToastContainer({
  items,
  dismiss,
}: {
  items: ToastItem[];
  dismiss: (id: number) => void;
}): React.JSX.Element {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2"
    >
      {items.map((t) => (
        <Toast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}): React.JSX.Element {
  // 进入动画
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setEntered(true));
  }, []);

  const text =
    item.text ??
    (item.kind === "success"
      ? SUCCESS_TEXT[item.payload as SuccessKind]
      : ERROR_TEXT[item.payload as ErrorKind]);

  return (
    <div
      role={item.kind === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm shadow-md transition-all duration-200",
        "min-w-[240px] max-w-[420px]",
        item.kind === "success"
          ? "border-success/30"
          : "border-error/30",
        entered ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0",
      )}
    >
      {item.kind === "success" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0 text-error" />
      )}
      <span
        className={cn(
          "flex-1 text-xs",
          item.kind === "success" ? "text-success" : "text-error",
        )}
      >
        {text}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="关闭"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-primary-hover"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// =============================================================
// 文案映射（§17 + §13）
// =============================================================

const SUCCESS_TEXT: Record<SuccessKind, string> = {
  Saved: "已保存",
  Favorited: "已收藏",
  Deleted: "已删除",
  Renamed: "已重命名",
};

const ERROR_TEXT: Record<ErrorKind, string> = {
  api_key: "API Key 无效或未配置，请前往设置",
  network: "网络连接失败，请重试",
  model: "模型服务异常，请稍后重试",
  timeout: "请求超时，请重试",
  validation: "输入内容不合法",
  unknown: "未知错误，请重试",
};

// =============================================================
// InlineMessage 4 类错误示范（用于 ApiKeyForm 内部使用）
// =============================================================

/** 4 类错误 + 对应 InLineMessage（可直接在组件内复用） */
export const ERROR_INLINE: Array<{
  kind: ErrorKind;
  text: string;
}> = [
  { kind: "api_key", text: ERROR_TEXT.api_key },
  { kind: "network", text: ERROR_TEXT.network },
  { kind: "model", text: ERROR_TEXT.model },
  { kind: "validation", text: ERROR_TEXT.validation },
];

export function ErrorMessageList(): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      {ERROR_INLINE.map((e) => (
        <InlineMessage key={e.kind} kind="error" text={e.text} />
      ))}
    </div>
  );
}
