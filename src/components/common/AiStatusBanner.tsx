/**
 * AiStatusBanner（§19.1）
 *
 * 集中展示 AI 5 个状态对应的 UI（按钮 + 文案 + 消息区表现）：
 * - `idle`       → Primary Send
 * - `sending`    → Ghost Stop（LoadingDots + "思考中…"）
 * - `generating` → Ghost Stop（文字追加 + 末尾 BlinkingCursor）
 * - `completed`  → Primary Send
 * - `failed`     → Primary Send（文案"重试"）
 * - `stopped`    → Primary Send（"已停止生成" 提示）
 *
 * ## 用法
 * ```tsx
 * const aiState = useChatStore((s) => s.aiState);
 * <AiStatusBanner state={aiState} onSend={...} onStop={...} canSend={...} />
 * ```
 */

import { Loader2, Send, Square } from "lucide-react";

import type { AiState } from "@/types/models";
import { cn } from "@/lib/utils";

import { BlinkingCursor } from "./BlinkingCursor";
import { InlineMessage } from "./InlineMessage";
import { LoadingDots } from "./LoadingDots";

interface AiStatusBannerProps {
  state: AiState;
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
  /** 上次错误（用于 failed 态的 Inline Error 展示） */
  errorMessage?: string;
}

export function AiStatusBanner({
  state,
  canSend,
  onSend,
  onStop,
  errorMessage,
}: AiStatusBannerProps): React.JSX.Element {
  const isStreaming = state === "sending" || state === "generating";
  const showSendLabel = state === "failed" ? "重试" : "发送";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-end gap-2">
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="停止生成"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary-strong transition-colors hover:bg-primary-tint"
          >
            {state === "sending" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Square className="h-4 w-4 fill-current" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label={showSendLabel}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
              canSend
                ? "bg-primary-strong text-primary-foreground hover:bg-primary-strong/90"
                : "cursor-not-allowed bg-border text-muted",
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 状态附带的辅助信息 */}
      {state === "sending" && (
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <LoadingDots /> 思考中…
        </div>
      )}
      {state === "generating" && (
        <div className="text-xs text-muted">
          AI 正在生成
          <BlinkingCursor />
        </div>
      )}
      {state === "stopped" && (
        <InlineMessage kind="info" text="已停止生成" />
      )}
      {state === "failed" && errorMessage !== undefined && (
        <InlineMessage kind="error" text={errorMessage} />
      )}
    </div>
  );
}
