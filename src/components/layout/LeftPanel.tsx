/**
 * LeftPanel
 *
 * 左侧组合面板：把原先的 Sidebar + ListPanel 合并为截图中的单栏效果。
 * - 顶部：品牌「小冰」+ 当前视图标题 + 操作按钮
 * - 中部：列表视图（带分组）
 * - 底部：4 个 Tab（对话 / 收藏 / 模型角色 / 设置）
 *
 * 点击条目后由全局 store 记录选中 id，右侧 ContentPanel 自动展示详情。
 */

import {
  MessageCircle,
  Star,
  Bot,
  Settings,
  Plus,
  FolderPlus,
} from "lucide-react";

import { useAppStore } from "@/stores/appStore";
import { useChatStore } from "@/features/chat/store";
import { useFavoriteStore } from "@/features/favorite/store";
import { useRoleStore } from "@/features/role/store";
import { useTreeViewStore } from "@/features/tree/store";
import { useGroupStore } from "@/features/group/store";
import { useDraftStore } from "@/stores/draftStore";
import { cn } from "@/lib/utils";
import { promptInput } from "@/components/common/PromptDialog";
import type { ViewMode } from "@/types/models";

import { ChatList } from "@/features/chat/components/ChatList";
import { FavoriteList } from "@/features/favorite/components/FavoriteList";
import { RoleList } from "@/features/role/components/RoleList";

const TABS: { view: ViewMode; label: string; icon: typeof MessageCircle }[] = [
  { view: "chat", label: "对话", icon: MessageCircle },
  { view: "favorite", label: "收藏", icon: Star },
  { view: "role", label: "角色", icon: Bot },
  { view: "settings", label: "设置", icon: Settings },
];

export function LeftPanel(): React.JSX.Element {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  const selectChat = useChatStore((s) => s.selectChat);
  const createNode = useTreeViewStore((s) => s.createNode);
  const loadChats = useChatStore((s) => s.loadChats);

  const selectFavorite = useFavoriteStore((s) => s.selectFavorite);
  const selectRole = useRoleStore((s) => s.selectRole);
  const createRole = useRoleStore((s) => s.createRole);

  const createGroup = useGroupStore((s) => s.createGroup);

  const onTabClick = (tab: ViewMode) => {
    // 切 Tab 时清除其他视图的选中态，避免右侧 ContentPanel 残留旧详情
    if (tab !== "chat") selectChat(null);
    if (tab !== "favorite") selectFavorite(null);
    if (tab !== "role") selectRole(null);
    setView(tab);
  };

  const onNewChat = async () => {
    const node = await createNode("新对话", null);
    if (node !== null) {
      await loadChats();
      selectChat(node.id);
      useDraftStore.getState().clearDraft();
    }
  };

  const onNewRole = () => {
    void createRole();
  };

  const listTitle: Record<ViewMode, string> = {
    chat: "",
    favorite: "",
    role: "",
    settings: "设置",
  };

  return (
    <section className="flex h-full w-[480px] shrink-0 flex-col border-r border-border bg-background">
      {/* 顶部 Header */}
      <header className="shrink-0 px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          {listTitle[view] && (
            <span className="text-sm font-medium text-foreground">{listTitle[view]}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {view === "chat" && (
              <>
                <button
                  type="button"
                  onClick={() => void onNewChat()}
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-primary-soft px-2.5 text-xs font-medium text-primary-strong hover:bg-primary-tint"
                >
                  <Plus className="h-3 w-3" />
                  新建对话
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const name = await promptInput("新建分组", "新分组");
                    if (name) {
                      void createGroup("chat", name);
                    }
                  }}
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-primary-soft px-2.5 text-xs font-medium text-primary-strong hover:bg-primary-tint"
                >
                  <FolderPlus className="h-3 w-3" />
                  新建分组
                </button>
              </>
            )}
            {view === "favorite" && (
              <button
                type="button"
                onClick={async () => {
                  const name = await promptInput("新建收藏分组", "新分组");
                  if (name) {
                    void createGroup("favorite", name);
                  }
                }}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-primary-soft px-2.5 text-xs font-medium text-primary-strong hover:bg-primary-tint"
              >
                <FolderPlus className="h-3 w-3" />
                新建分组
              </button>
            )}
            {view === "role" && (
              <>
                <button
                  type="button"
                  onClick={onNewRole}
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-primary-soft px-2.5 text-xs font-medium text-primary-strong hover:bg-primary-tint"
                >
                  <Plus className="h-3 w-3" />
                  新建角色
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const name = await promptInput("新建角色分组", "新分组");
                    if (name) {
                      void createGroup("role", name);
                    }
                  }}
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-primary-soft px-2.5 text-xs font-medium text-primary-strong hover:bg-primary-tint"
                >
                  <FolderPlus className="h-3 w-3" />
                  新建分组
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 列表区 */}
      <main className="scroll-area min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {view === "chat" && <ChatList />}
        {view === "favorite" && <FavoriteList />}
        {view === "role" && <RoleList />}
      </main>

      {/* 底部 Tab Bar */}
      <nav className="shrink-0 flex items-center justify-around border-t border-border bg-background px-2 py-2">
        {TABS.map((tab) => {
          const active = view === tab.view;
          const Icon = tab.icon;
          return (
            <button
              key={tab.view}
              type="button"
              onClick={() => onTabClick(tab.view)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-2xl px-5 py-2 transition-colors",
                active
                  ? "bg-primary-soft text-primary-strong"
                  : "text-muted hover:bg-primary-hover",
              )}
            >
              <Icon
                className={cn("h-6 w-6", active && "fill-current")}
                strokeWidth={active ? 2 : 1.5}
              />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </section>
  );
}
