/**
 * ChatList（§8.2 + §13）
 *
 * 列表容器：调 `chatStore.loadChats()` 拉数据，渲染 `<ChatItem />`。
 * 顶部 sticky loading 提示；空状态用 `<EmptyState />`。
 *
 * 集成位置：`ListPanel`（当 `appStore.view === 'chat'` 时挂载）。
 */

import { useEffect } from "react";
import { MessageSquare } from "lucide-react";

import { useChatStore } from "@/features/chat/store";
import { useTreeViewStore } from "@/features/tree/store";

import { ChatItem } from "./ChatItem";
import { EmptyState } from "@/components/common/EmptyState";

export function ChatList(): React.JSX.Element {
  const chats = useChatStore((s) => s.chats);
  const status = useChatStore((s) => s.status);
  const loadChats = useChatStore((s) => s.loadChats);

  // 只显示根节点（tree_nodes.parent_id IS NULL）。
  // tree_nodes 与 chats 共享 id，rootNodeIds 来自 treeViewStore。
  const rootNodeIds = useTreeViewStore((s) => s.rootNodeIds);
  const rootSet = new Set(rootNodeIds);
  const rootChats = chats.filter((c) => rootSet.has(c.id));

  useEffect(() => {
    if (status === "empty") {
      void loadChats();
    }
  }, [status, loadChats]);

  if (status === "loading" && chats.length === 0) {
    return <div className="p-4 text-xs text-muted">加载中…</div>;
  }

  if (status === "error") {
    return (
      <EmptyState
        icon={MessageSquare}
        title="加载失败"
        subtitle="请检查网络或重启应用"
      />
    );
  }

  if (rootChats.length === 0) {
    // §18.2 Chat（无对话）空态
    return (
      <EmptyState
        icon={MessageSquare}
        title="开始你的第一次对话"
        subtitle="在下方输入框输入内容，按 Enter 发送"
      />
    );
  }

  return (
    <ul className="flex flex-col gap-1 py-1 list-none p-0 m-0">
      {rootChats.map((c) => (
        <ChatItem key={c.id} chat={c} />
      ))}
    </ul>
  );
}
