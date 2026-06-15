/**
 * Sidebar（§9.2 + §10 + §11）
 *
 * 展开态：240px 固定宽度，背景 `bg-sidebar`。
 * 折叠态：60px 固定宽度，仅显示图标（Logo + 菜单项 + 切换按钮）。
 *
 * 自上而下：Logo → 分隔线 → 三个 NavItem → (flexible spacer) → 折叠/展开按钮。
 *
 * 三个菜单项（§10.1）：
 * - 对话  → `MessageSquare` 图标
 * - 收藏  → `Star` 图标
 * - 设置  → `Settings` 图标
 *
 * Logo（§11.2）："小冰 ✦"，字号 16px / 600
 * - 展开态："小冰" 颜色 `text-foreground`，"✦" 颜色 `text-primary`
 * - 折叠态：只显示 ✦，并居中
 */

import {
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Star,
} from "lucide-react";

import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/types/models";

import { NavItem } from "./NavItem";

interface MenuItem {
  view: ViewMode;
  label: string;
  icon: typeof MessageSquare;
}

const TOP_MENU_ITEMS: readonly MenuItem[] = [
  { view: "chat", label: "对话", icon: MessageSquare },
  { view: "favorite", label: "收藏", icon: Star },
] as const;

const BOTTOM_MENU_ITEMS: readonly MenuItem[] = [
  { view: "settings", label: "设置", icon: Settings },
] as const;

/** Sidebar 宽度常量（与 AppShell grid 同步） */
export const SIDEBAR_WIDTH_EXPANDED = 240; // px
export const SIDEBAR_WIDTH_COLLAPSED = 60; // px

export function Sidebar(): React.JSX.Element {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "flex h-full flex-col gap-1 border-r border-border bg-sidebar p-3 transition-[width] duration-200 ease-out",
        sidebarCollapsed ? "w-[60px]" : "w-[240px]",
      )}
      data-collapsed={sidebarCollapsed ? "true" : "false"}
    >
      {/* Logo（§11.2）：展开态显示完整 logo；折叠态只显示 ✦ */}
      <div
        className={cn(
          "flex items-baseline gap-1 py-2 text-base font-semibold tracking-tight",
          sidebarCollapsed ? "justify-center px-0" : "px-3",
        )}
      >
        {sidebarCollapsed ? (
          <span className="text-lg text-primary" title="小冰 ✦">
            ✦
          </span>
        ) : (
          <>
            <span className="text-foreground">小冰</span>
            <span className="text-primary">✦</span>
          </>
        )}
      </div>

      {/* 分隔线（折叠态用上下边距收紧） */}
      <div
        className={cn(
          "h-px bg-border",
          sidebarCollapsed ? "my-1" : "my-2",
        )}
      />

      {/* 顶部菜单项：对话 + 收藏（§10） */}
      <nav
        className={cn(
          "flex flex-col gap-1",
          sidebarCollapsed ? "items-center" : "",
        )}
      >
        {TOP_MENU_ITEMS.map((item) => (
          <NavItem
            key={item.view}
            icon={item.icon}
            label={item.label}
            active={view === item.view}
            collapsed={sidebarCollapsed}
            onClick={() => setView(item.view)}
          />
        ))}
      </nav>

      {/* 中部 flexible spacer */}
      <div className="flex-1" />

      {/* 底部菜单项：设置（§10） */}
      <nav
        className={cn(
          "flex flex-col gap-1",
          sidebarCollapsed ? "items-center" : "",
        )}
      >
        {BOTTOM_MENU_ITEMS.map((item) => (
          <NavItem
            key={item.view}
            icon={item.icon}
            label={item.label}
            active={view === item.view}
            collapsed={sidebarCollapsed}
            onClick={() => setView(item.view)}
          />
        ))}
      </nav>

      {/* 分隔线 */}
      <div
        className={cn(
          "h-px bg-border",
          sidebarCollapsed ? "my-1" : "my-2",
        )}
      />

      {/* 折叠/展开切换按钮 */}
      <div
        className={cn(
          "flex",
          sidebarCollapsed ? "justify-center" : "",
        )}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
          aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
          className={cn(
            "h-10 rounded-md text-left transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            "bg-transparent text-muted hover:bg-primary-hover hover:text-foreground",
            sidebarCollapsed ? "w-10" : "w-full px-3",
          )}
        >
          <span
            className={cn(
              "flex h-full w-full items-center gap-2",
              sidebarCollapsed ? "justify-center" : "",
            )}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
                strokeWidth={2}
              />
            ) : (
              <>
                <PanelLeftClose
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                  strokeWidth={2}
                />
                <span className="truncate text-sm">收起侧栏</span>
              </>
            )}
          </span>
        </button>
      </div>
    </aside>
  );
}
