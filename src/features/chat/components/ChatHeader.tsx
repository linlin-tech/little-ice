/**
 * ChatHeader（统一 Header，§3）
 *
 * 一个 Header，两种状态自适应：
 * - 对话状态：[查看导图] 节点名·角色 ★N
 * - 树形图状态：[查看对话] 节点名·角色 ★N
 *
 * 集成位置：ContentPanel 顶部（对话 / 树图两种视图共用）。
 */

import { useEffect, useRef, useState } from "react";
import { GitBranch } from "lucide-react";

import { useAppStore } from "@/stores/appStore";
import { useChatStore } from "@/features/chat/store";
import { useRoleStore } from "@/features/role/store";
import { useTreeViewStore } from "@/features/tree/store";

import { FavoriteCountBadge } from "./FavoriteCountBadge";

export function ChatHeader(): React.JSX.Element | null {
  const treeViewMode = useAppStore((s) => s.treeViewMode);
  const setTreeViewMode = useAppStore((s) => s.setTreeViewMode);

  const currentChatId = useChatStore((s) => s.currentChatId);
  const chats = useChatStore((s) => s.chats);
  const favoriteCount = useChatStore((s) => s.favoriteCount);
  const renameChat = useChatStore((s) => s.renameChat);
  const selectChat = useChatStore((s) => s.selectChat);

  const roles = useRoleStore((s) => s.roles);
  const allNodes = useTreeViewStore((s) => s.allNodes);
  const selectedNodeId = useTreeViewStore((s) => s.selectedNodeId);
  const setSelectedNode = useTreeViewStore((s) => s.setSelectedNode);
  const renameNode = useTreeViewStore((s) => s.renameNode);

  // 当前节点：对话视图用 currentChatId，树图视图用 selectedNodeId
  const activeNodeId = treeViewMode === "chat" ? currentChatId : selectedNodeId;
  const chat = chats.find((c) => c.id === activeNodeId) ?? null;
  const treeNode = activeNodeId ? allNodes.get(activeNodeId) : null;
  const role = roles.find((r) => r.id === (chat?.roleId ?? treeNode?.roleId)) ?? null;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chat?.title ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(chat?.title ?? treeNode?.title ?? "");
  }, [chat?.title, treeNode?.title, editing]);

  if (activeNodeId === null) return null;

  const nodeTitle = chat?.title ?? treeNode?.title ?? "";
  const nodeId = activeNodeId;

  const startEdit = () => {
    setDraft(nodeTitle);
    setEditing(true);
  };

  const commit = async () => {
    const next = draft.trim();
    setEditing(false);
    if (next.length === 0 || next === nodeTitle) {
      setDraft(nodeTitle);
      return;
    }
    // 同步更新 chat 和 tree node
    await renameChat(nodeId, next);
    await renameNode(nodeId, next);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(nodeTitle);
  };

  const handleToggleView = () => {
    if (treeViewMode === "chat") {
      // 切到树图：同步选中当前对话节点
      if (currentChatId) setSelectedNode(currentChatId);
      setTreeViewMode("tree");
    } else {
      // 切到对话：加载选中节点的对话
      if (selectedNodeId) {
        void selectChat(selectedNodeId);
      }
      setTreeViewMode("chat");
    }
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-6 select-none">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* 切换视图按钮：仅在对话状态显示，图标 + 文字 */}
        {treeViewMode === "chat" && (
          <button
            type="button"
            aria-label="查看导图"
            onClick={handleToggleView}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-normal text-primary-strong transition-colors hover:bg-primary-soft active:text-primary"
          >
            <GitBranch className="h-4 w-4" />
            查看导图
          </button>
        )}

        {/* 节点名 · 角色 */}
        <div className="flex min-w-0 items-center gap-1.5">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                }
              }}
              className="min-w-0 border-0 border-b border-primary bg-transparent text-[15px] font-medium leading-snug text-foreground outline-none"
            />
          ) : (
            <h1
              onClick={startEdit}
              title="点击重命名"
              className="min-w-0 cursor-pointer truncate text-[15px] font-medium text-foreground transition-colors hover:text-primary-strong"
            >
              {nodeTitle}
            </h1>
          )}

          {role && (
            <>
              <span className="shrink-0 text-xs text-muted">·</span>
              <span className="shrink-0 text-sm font-normal text-muted">
                {role.name}
              </span>
            </>
          )}
        </div>
      </div>

      <FavoriteCountBadge count={favoriteCount} />
    </header>
  );
}
