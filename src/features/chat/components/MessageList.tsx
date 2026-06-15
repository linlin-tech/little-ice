/**
 * MessageList（§14）
 *
 * 渲染当前 chat 的所有 messages。最新的消息在底部。
 * 当 currentChatId 为 null 时展示 `<EmptyState />`。
 */

import { useEffect } from "react";
import { MessageSquare } from "lucide-react";

import { useChatStore } from "@/features/chat/store";

import { EmptyState } from "@/components/common/EmptyState";
import { MessageItem } from "./MessageItem";

export function MessageList(): React.JSX.Element {
  const currentChatId = useChatStore((s) => s.currentChatId);
  const messages = useChatStore((s) => s.messages);
  const messagesStatus = useChatStore((s) => s.messagesStatus);
  const selectChat = useChatStore((s) => s.selectChat);
  const loadFavoriteCount = useChatStore((s) => s.loadFavoriteCount);

  // 选中时主动调一次 loadFavoriteCount（已由 selectChat 内部 Promise.all 触发，
  // 这里再保险一次——若用户从 favorite 页面切回 chat，徽章要新鲜）
  useEffect(() => {
    if (currentChatId !== null) {
      void loadFavoriteCount(currentChatId);
    }
  }, [currentChatId, loadFavoriteCount]);

  if (currentChatId === null) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="还未选中任何对话"
        subtitle="从左侧列表选一个，或点击 新对话"
        action={
          <button
            type="button"
            onClick={() => {
              // 跳到 chat 视图（虽然已经在 chat 视图，但 list 不会空）
              void selectChat("");
            }}
            className="hidden"
          >
            placeholder
          </button>
        }
      />
    );
  }

  if (messagesStatus === "loading" && messages.length === 0) {
    return <div className="p-6 text-sm text-muted">加载消息…</div>;
  }

  if (messagesStatus === "error") {
    return (
      <EmptyState
        icon={MessageSquare}
        title="加载消息失败"
        subtitle="请重试或检查后端"
      />
    );
  }

  if (messages.length === 0) {
    // §18.2 Chat（无消息）空态
    return (
      <EmptyState
        icon={MessageSquare}
        title="还没有消息"
        subtitle="发送一条消息试试"
      />
    );
  }

  return (
    // 去掉 list-style + padding-left 40px，避免消息向右偏移错位
    <ol className="flex flex-col gap-4 list-none p-0">
      {messages.map((m) => (
        <li key={m.id}>
          <MessageItem message={m} />
        </li>
      ))}
    </ol>
  );
}
