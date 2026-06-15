/**
 * ChatContent（§8.2）
 *
 * 组合：Header（§14.0）+ MessageList（§14）+ ChatInput（§15）。
 * - Header：sticky 在顶部
 * - 中间：消息列表，溢出滚动
 * - 底部：输入框（ChatInput 自动吸底用 flex-col）
 *
 * 集成位置：`ContentPanel`（当 `appStore.view === 'chat'` 时挂载）。
 */

import { useEffect } from "react";

import { useChatStore } from "@/features/chat/store";
import { bindChatStreamEvents } from "@/features/chat/store";

import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

export function ChatContent(): React.JSX.Element {
  const currentChatId = useChatStore((s) => s.currentChatId);
  const loadMessages = useChatStore((s) => s.selectChat);

  // 切 chat：拉 messages + favoriteCount
  useEffect(() => {
    if (currentChatId !== null) {
      void loadMessages(currentChatId);
    }
  }, [currentChatId, loadMessages]);

  // 全局 AI 事件订阅（应用启动时一次性挂载，cleanup 在 unmount）
  useEffect(() => {
    const unlisten = bindChatStreamEvents();
    return () => {
      void unlisten.then((u) => u());
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <ChatHeader />
      {/* flex-1 + overflow-y-auto 必须配 min-h-0才能正确收缩滚动
          （flex 子项默认 min-height: auto 会撑爆容器导致滚动失效）。
          scroll-area 工具类（globals.css）使滚动条默认隐藏，hover 才显示 6px 细条。 */}
      <div className="scroll-area flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <MessageList />
      </div>
      <ChatInput />
    </div>
  );
}
