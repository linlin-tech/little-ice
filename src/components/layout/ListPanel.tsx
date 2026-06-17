/**
 * ListPanel（§9.3）
 *
 * 320px 固定宽度，背景 bg-background。
 *
 * 结构：
 * - 顶部「侧栏展开按钮」（仅 sidebarCollapsed = true 时显示，方便用户一键展开）
 * - 按 appStore.view 渲染对应 toolbar：chat → ChatToolbar；favorite → FavoriteToolbar
 * - 中部列表区：chat → ChatList；favorite → FavoriteList；settings → 留空
 *
 * - chat     → ChatToolbar + ChatList
 * - favorite → FavoriteList（占位）
 * - settings → 留空（Settings 是 Page，不在 ListPanel）
 */

import { PanelLeftOpen } from "lucide-react";

import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/utils";

import { ChatList } from "@/features/chat/components/ChatList";
import { ChatToolbar } from "@/features/chat/components/ChatToolbar";
import { FavoriteList } from "@/features/favorite/components/FavoriteList";
import { FavoriteToolbar } from "@/features/favorite/components/FavoriteToolbar";
import { RoleList } from "@/features/role/components/RoleList";
import { RoleToolbar } from "@/features/role/components/RoleToolbar";

export function ListPanel(): React.JSX.Element {
  const view = useAppStore((s) => s.view);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <section
      className={cn(
        "relative z-10 flex h-full flex-col border-r border-border bg-background",
      )}
    >
      {/* 侧栏展开按钮（仅折叠态显示）：
          - 独立行高度 h-9，避免与下方 toolbar (h-12) 视觉冲突
          - 紧贴 ListPanel 左侧边缘，配合折叠态 Sidebar 右侧的 ✦ logo，
            让用户从折叠态下任何视图都能一键展开 */}
      {sidebarCollapsed && (
        <div className="flex h-9 shrink-0 items-center border-b border-border px-3">
          <button
            type="button"
            onClick={toggleSidebar}
            title="展开侧栏"
            aria-label="展开侧栏"
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md",
              "text-muted transition-colors hover:bg-primary-hover hover:text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
          >
            <PanelLeftOpen
              className="h-3.5 w-3.5"
              aria-hidden="true"
              strokeWidth={2}
            />
          </button>
        </div>
      )}

      {view === "chat" && <ChatToolbar />}
      {view === "favorite" && <FavoriteToolbar />}
      {view === "role" && <RoleToolbar />}
      <div className="flex-1 overflow-y-auto">
        {view === "chat" && <ChatList />}
        {view === "favorite" && <FavoriteList />}
        {view === "role" && <RoleList />}
        {view === "settings" && null}
      </div>
    </section>
  );
}
