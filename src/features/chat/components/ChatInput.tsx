/**
 * ChatInput（§15）
 *
 * 固定在 Content Panel 底部，最大宽度 720px（与消息对齐）。
 * 含 textarea（min-h 56 / max-h 200）+ 右下角内嵌的 Send/Stop 按钮。
 *
 * AI 状态机决定按钮：
 * - idle | completed | stopped | failed → Send（Primary，§12.1）
 * - sending | generating               → Stop（Soft 风格 + 旋转图标，§15.3）
 *
 * draftStore 持久化用户键入（重启不丢）；发送成功后 `clearDraft()`。
 *
 * Enter 发送，Shift+Enter 换行。
 */

import { Loader2, Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useChatStore } from "@/features/chat/store";
import { useDraftStore } from "@/stores/draftStore";
import { cn } from "@/lib/utils";


export function ChatInput(): React.JSX.Element | null {
  const currentChatId = useChatStore((s) => s.currentChatId);
  const aiState = useChatStore((s) => s.aiState);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopGeneration = useChatStore((s) => s.stopGeneration);
  const error = useChatStore((s) => s.error);

  const draft = useDraftStore((s) => s.draft);
  const setDraft = useDraftStore((s) => s.setDraft);
  const clearDraft = useDraftStore((s) => s.clearDraft);

  const [localDraft, setLocalDraft] = useState(draft);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // draftStore 变化时同步（外部 reset 也能跟上）
  useEffect(() => {
    setLocalDraft(draft);
  }, [draft]);

  // 切 chat 时聚焦
  useEffect(() => {
    if (currentChatId !== null) taRef.current?.focus();
  }, [currentChatId]);

  // 自动撑高（56 → 200，§15.2）
  useEffect(() => {
    const ta = taRef.current;
    if (ta === null) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [localDraft]);

  if (currentChatId === null) return null;

  const isStreaming = aiState === "sending" || aiState === "generating";
  const canSend = !isStreaming && localDraft.trim().length > 0;

  const onSend = async () => {
    if (!canSend) return;
    const content = localDraft.trim();
    clearDraft();
    await sendMessage(content);
  };

  const onStop = () => {
    void stopGeneration();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void onSend();
    }
  };

  return (
    <div
      // §15.1 容器：固定底部 / bg / 顶 border / py-4 px-6 / 与对话区域同宽
      className="shrink-0 border-t border-border bg-background px-6 py-4"
    >
      <div className="relative">
        <div
          // textarea 容器：relative 让 Send 按钮绝对定位右下角
          className="relative"
        >
          <textarea
            ref={taRef}
            value={localDraft}
            onChange={(e) => {
              setLocalDraft(e.target.value);
              setDraft(e.target.value);
            }}
            onKeyDown={onKeyDown}
            placeholder="请输入内容…（回车 发送，Shift+回车 换行）"
            rows={3}
            // §15.2：min-h-14 (56px) / max-h-50 (200px) / px-3.5 py-3 / rounded-md / focus:border-primary + ring
            className={cn(
              "w-full resize-none rounded-md border bg-background px-3.5 py-3 text-sm leading-relaxed text-foreground outline-none",
              "min-h-14 max-h-50",
              "border-border focus:border-primary focus:ring-2 focus:ring-primary/15",
              isStreaming && "opacity-60",
            )}
            disabled={isStreaming}
          />

          {/* Send / Stop 按钮：右下角内嵌（§15.3） */}
          <div className="absolute bottom-2 right-2">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="停止生成"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary-strong transition-colors hover:bg-primary-tint"
              >
                {aiState === "sending" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4 fill-current" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onSend()}
                disabled={!canSend}
                aria-label="发送"
                // §12.1 Primary Button：bg-primary-strong / text-primary-foreground / disabled:bg-border
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
        </div>

        {/* 错误条（§17.2：Inline Message 紧贴触发处） */}
        {error !== null && aiState === "failed" && (
          <p className="mt-2 border-l-[3px] border-error pl-2 text-xs text-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
