/**
 * ChatToolbar（§8.2 + §12.2）
 *
 * ListPanel 顶部 toolbar，含一个 New Chat 按钮（**Soft** 风格：柔色背景，§12.2）。
 * 按钮点击 → `chatStore.createChat` → 自动 select 新 chat + 清空 draft。
 *
 * 集成位置：`ListPanel`（仅在 `appStore.view === 'chat'` 时显示）。
 */

import { MessageSquare, Plus } from "lucide-react";

import { useChatStore } from "@/features/chat/store";
import { useTreeViewStore } from "@/features/tree/store";
import { useDraftStore } from "@/stores/draftStore";

export function ChatToolbar(): React.JSX.Element {
  const chats = useChatStore((s) => s.chats);
  const onNewChat = async () => {
    // 通过 treeViewStore 创建根节点（同时写入 chats + tree_nodes，保持一致）
    const node = await useTreeViewStore.getState().createNode("新对话", null);
    if (node !== null) {
      // 刷新 chatStore 的 chats 列表（拿到新记录）
      await useChatStore.getState().loadChats();
      useChatStore.getState().selectChat(node.id);
      useDraftStore.getState().clearDraft();
    }
  };

  return (
    <div className="flex h-12 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted" />
        <span className="text-sm font-medium text-foreground">对话</span>
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-strong">
          {chats.length}
        </span>
      </div>
      <button
        type="button"
        onClick={() => void onNewChat()}
        // §12.2 Soft Button：bg-primary-soft / text-primary-strong
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary-soft px-3 text-sm font-medium text-primary-strong transition-colors hover:bg-primary-tint"
      >
        <Plus className="h-3.5 w-3.5 align-middle" />
        <span className="align-middle">新建对话</span>
      </button>
    </div>
  );
}
