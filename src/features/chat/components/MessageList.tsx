/**
 * MessageList（§14）
 *
 * 渲染当前 chat 的所有 messages。最新的消息在底部。
 * 当 currentChatId 为 null 时展示 `<EmptyState />`。
 *
 * ## 性能（流式滚动卡顿修复）
 *
 * 把 `streamingMessageId` 的订阅从 MessageItem 上移到 MessageList，
 * 通过 prop `streaming={streamingMessageId === m.id}` 传给子组件；
 * MessageItem 用 React.memo 包裹后，**非流式消息在 chunks 期间不会重渲染**，
 * 滚动查看时不再因每条消息都重跑 Markdown 解析而卡顿。
 *
 * ## 自动滚动（follow-mode）
 *
 * 流式期间默认滚到底部跟随新内容，但若用户主动上滑查看历史消息，
 * 则暂停自动滚动，避免把用户拽回底部；用户再次滚到底部时恢复跟随。
 */

import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";

import { useChatStore } from "@/features/chat/store";

import { EmptyState } from "@/components/common/EmptyState";
import { MessageItem } from "./MessageItem";

const FOLLOW_THRESHOLD_PX = 80;

export function MessageList(): React.JSX.Element {
  const currentChatId = useChatStore((s) => s.currentChatId);
  const messages = useChatStore((s) => s.messages);
  const messagesStatus = useChatStore((s) => s.messagesStatus);
  const streamingMessageId = useChatStore((s) => s.streamingMessageId);
  const selectChat = useChatStore((s) => s.selectChat);
  const loadFavoriteCount = useChatStore((s) => s.loadFavoriteCount);

  // 选中时主动调一次 loadFavoriteCount（已由 selectChat 内部 Promise.all 触发，
  // 这里再保险一次——若用户从 favorite 页面切回 chat，徽章要新鲜）
  useEffect(() => {
    if (currentChatId !== null) {
      void loadFavoriteCount(currentChatId);
    }
  }, [currentChatId, loadFavoriteCount]);

  // ===== 自动滚动（follow-mode）=====
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const followModeRef = useRef(true);

  // 找到最近的外层 overflow-y-auto 滚动容器（ChatContent 的 .scroll-area）
  useEffect(() => {
    // 切对话后默认跟随到底部，让用户直接看到最新讨论内容
    followModeRef.current = true;

    const findScrollParent = (
      el: HTMLElement | null,
    ): HTMLElement | null => {
      let cur: HTMLElement | null = el;
      while (cur) {
        const style = getComputedStyle(cur);
        if (
          style.overflowY === "auto" ||
          style.overflowY === "scroll" ||
          style.overflowY === "overlay"
        ) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return null;
    };
    const container = findScrollParent(sentinelRef.current);
    scrollContainerRef.current = container;
    if (!container) return;

    const onScroll = () => {
      const distance =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      followModeRef.current = distance < FOLLOW_THRESHOLD_PX;
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    // 初始化：当前就在底部则跟随，否则不跟随
    onScroll();
    return () => {
      container.removeEventListener("scroll", onScroll);
    };
  }, [currentChatId]);

  // 消息列表更新时：若处于跟随模式，滚到底部
  useEffect(() => {
    if (!followModeRef.current) return;
    sentinelRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streamingMessageId]);

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
          <MessageItem
            message={m}
            streaming={streamingMessageId === m.id}
          />
        </li>
      ))}
      {/* 滚动哨兵：用于 follow-mode 自动滚动 */}
      <div ref={sentinelRef} aria-hidden="true" />
    </ol>
  );
}
