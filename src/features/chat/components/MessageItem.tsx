/**
 * MessageItem（§14.1 / §14.2 / §14.3）
 *
 * 单条消息：按 `role` 渲染不同样式
 * - `user`     → 右对齐 + 气泡（bg-user-bubble）
 * - `assistant` → 左对齐 + 无气泡（透明背景），Markdown 渲染
 * - `system`  → 居中 + 灰色无背景
 *
 * AI 消息 hover 时显示 Copy + Favorite（§8.2）两个 IconButton。
 * Copy → navigator.clipboard；Favorite → 创建 favorite（调 favorite store）。
 *
 * 流式中（`streaming === true`）的 assistant 消息显示"光标"动画。
 *
 * ## 性能（流式滚动卡顿修复）
 *
 * 整组件用 React.memo 包裹，仅依赖 `message` 和 `streaming` 两个 prop 的浅比较。
 * `streaming` 由父组件 MessageList 从 chatStore 订阅后传入，本组件**不再订阅 streamingMessageId**，
 * 避免 chunks 期间整条消息列表都重跑 Markdown 解析导致滚动卡顿：
 *
 * - 非流式消息（streaming=false 且 message 引用不变）→ React.memo 直接 bail out，不重渲染
 * - 流式消息（streaming=true 且 message.content 随 chunk 增长）→ 必然重渲染（必要）
 *
 * 内部 useChatStore 仅取函数引用（loadFavoriteCount），函数引用稳定不触发额外渲染。
 */

import { Check, Copy, Star } from "lucide-react";
import { memo, useEffect, useState } from "react";

import { useChatStore } from "@/features/chat/store";
import { useFavoriteStore } from "@/features/favorite/store";
import { useCreateFavorite } from "@/features/favorite/components/CreateFavoriteDialog";
import { BlinkingCursor } from "@/components/common/BlinkingCursor";
import { confirmDestructive } from "@/components/common/ConfirmDialog";
import { cn } from "@/lib/utils";
import type { Message, MessageRole } from "@/types/models";

import { MessageMarkdown } from "./MessageMarkdown";

interface MessageItemProps {
  message: Message;
  /** 当前 assistant 消息是否正在流式接收（控制光标动画 + Markdown 实时更新） */
  streaming: boolean;
}

function MessageItemImpl({
  message,
  streaming,
}: MessageItemProps): React.JSX.Element | null {
  if (message.role === "user") return <UserMessage message={message} />;
  if (message.role === "assistant") {
    return <AssistantMessage message={message} streaming={streaming} />;
  }
  if (message.role === "system") return <SystemMessage message={message} />;
  return null;
}

export const MessageItem = memo(MessageItemImpl);

// =============================================================
// User Message（§14.1）：右对齐 + 气泡
// =============================================================

function UserMessage({
  message,
}: {
  message: Message;
}): React.JSX.Element {
  return (
    <div className="flex justify-end">
      <div
        // §14.1：bg-user-bubble / px-3.5 py-2.5 / rounded-md / 文字 primary
        // 最大宽度 70% Content Panel
        className="max-w-[70%] rounded-md bg-user-bubble px-3.5 py-2.5 text-sm leading-relaxed text-foreground"
      >
        {message.content}
      </div>
    </div>
  );
}

// =============================================================
// Assistant Message（§14.2）：左对齐 + 无气泡 + Markdown
// =============================================================

function AssistantMessage({
  message,
  streaming,
}: {
  message: Message;
  streaming: boolean;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const openCreateFavorite = useCreateFavorite();
  const deleteFavorite = useFavoriteStore((s) => s.deleteFavorite);
  // 只取函数引用，函数引用稳定不触发组件重渲染
  const loadFavoriteCount = useChatStore((s) => s.loadFavoriteCount);
  const [favorited, setFavorited] = useState<{ id: string } | null>(null);

  // 检查该消息是否已被收藏
  // 仅在 message.id 变化时触发——流式期间 content 每 chunk 都变，不能作为依赖
  useEffect(() => {
    let cancelled = false;
    const tauri = import("@/lib/tauri").then((m) => m.tauri);
    tauri.then((t) =>
      t.getFavoriteByMessageId(message.id).then((fav) => {
        if (!cancelled) {
          setFavorited(fav ? { id: fav.id } : null);
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [message.id]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 忽略：clipboard 可能被拒绝（如非安全上下文）
    }
  };

  const onFavorite = () => {
    if (favorited) {
      // 已收藏：弹出确认，确认后删除收藏
      void (async () => {
        const confirmed = await confirmDestructive(
          "要取消收藏此内容吗？",
        );
        if (confirmed) {
          await deleteFavorite(favorited.id);
          setFavorited(null);
          void loadFavoriteCount(message.chatId);
        }
      })();
    } else {
      // 未收藏：弹出创建对话框，成功后立即更新状态
      openCreateFavorite({
        sourceContent: message.content,
        sourceChatId: message.chatId,
        sourceMessageId: message.id,
        onCreated: (favId) => setFavorited({ id: favId }),
      });
    }
  };

  return (
    <div
      // §14.2：左对齐 / 无气泡 / line-height 1.9
      className="group flex justify-start"
    >
      {/* AI 回复占满对话区域宽度并左对齐，不再限制为 80% 或居中。 */}
      <div className="relative w-full">
        <div className="relative">
          <div className="text-sm leading-[1.9] text-foreground">
            {message.content.length === 0 && streaming ? (
              <span className="text-muted">思考中...</span>
            ) : (
              <MessageMarkdown content={message.content} />
            )}
          </div>
          {streaming && message.content.length > 0 && (
            <span className="absolute -bottom-0.5 left-0 translate-y-full">
              <BlinkingCursor />
            </span>
          )}
        </div>

        {/* hover 才显示的 Copy + Favorite（§8.2，opacity 0 → 100） */}
        <div
          className={cn(
            "absolute -bottom-1 left-0 flex items-center gap-1",
            "mt-3 translate-y-full",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
          )}
        >
          <ActionIcon
            ariaLabel="复制"
            active={copied}
            onClick={() => void onCopy()}
            activeIcon={<Check className="h-3.5 w-3.5" />}
            idleIcon={<Copy className="h-3.5 w-3.5" />}
          />
          <button
            type="button"
            aria-label={favorited ? "取消收藏" : "收藏"}
            onClick={onFavorite}
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors",
              favorited
                ? "text-primary-strong hover:bg-primary-hover"
                : "text-muted hover:bg-primary-hover hover:text-primary-strong",
            )}
          >
            <Star
              className="h-3.5 w-3.5"
              fill={favorited ? "currentColor" : "none"}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// System Message（§14.3）：居中 + 灰色
// =============================================================

function SystemMessage({
  message,
}: {
  message: Message;
}): React.JSX.Element {
  return (
    <div className="flex justify-center">
      <p className="text-xs text-muted">{message.content}</p>
    </div>
  );
}

// =============================================================
// ActionIcon：hover 操作（Copy / Favorite）—— active 态自动变色
// =============================================================

interface ActionIconProps {
  onClick: () => void;
  ariaLabel: string;
  active: boolean;
  activeIcon: React.ReactNode;
  idleIcon: React.ReactNode;
}

function ActionIcon({
  onClick,
  ariaLabel,
  active,
  activeIcon,
  idleIcon,
}: ActionIconProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors",
        "hover:bg-primary-hover hover:text-primary-strong",
        active && "text-primary-strong",
      )}
    >
      {active ? activeIcon : idleIcon}
    </button>
  );
}

// =============================================================
// 辅助：让父组件能在 selectedRole 用类型守卫（保留 MessageRole 引用）
// =============================================================
export type { MessageRole };
