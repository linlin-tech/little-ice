/**
 * NavItem（§10）
 *
 * Sidebar 菜单项：[Icon] 文字
 * 状态（§10.2）：
 * - 默认：`bg-transparent` + `text-foreground`
 * - Hover：`bg-primary-hover` + `text-foreground`
 * - Active（当前页面）：`bg-primary-soft` + `text-primary-strong`
 *
 * 尺寸：
 * - 展开态：左右各 `px-3`，高度 `h-10`，圆角 `rounded-md`（10px）。
 * - 收起态（Sidebar 折叠时）：居中图标按钮，宽度自适应，高度 `h-10`。
 *
 * ## svg + 文字对齐（项目级规则）
 *
 * Tauri / WebKitGTK 中 `<button>` 有默认的 `-webkit-box-align` 等样式，
 * 可能覆盖 Tailwind 的 `items-center`，导致 svg 与文字看起来错位。
 * 因此把 `flex items-center` 放在 button 内部的 wrapper 上，避免受
 * button 默认样式影响。
 *
 * 1. button 只负责外形、颜色、focus；布局交给内部 wrapper。
 * 2. wrapper = `flex items-center gap-2`，单一 flex 行。
 * 3. svg 尺寸 = 文字字号（text-sm 14px ↔ h-3.5 w-3.5），严格相等。
 * 4. 文字使用 Tailwind `text-sm` 默认行高（leading-normal 1.5），
 *    不紧压行高，避免中文字体 ascent 过高导致顶部被裁。
 * 5. 超长文字用 `truncate` 截断，但容器高度由默认行高撑起，不会裁剪。
 *
 * `onClick` 由父级处理（一般是 `appStore.setView(...)`）。
 */

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  /**
   * Sidebar 折叠态：仅渲染图标 + title tooltip；
   * 展开态：渲染 [Icon] 文字  横向布局。
   */
  collapsed?: boolean;
}

export function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
  collapsed = false,
}: NavItemProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "h-10 rounded-md text-left transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        collapsed ? "w-10" : "w-full px-3",
        active
          ? "bg-primary-soft text-primary-strong"
          : "bg-transparent text-foreground hover:bg-primary-hover",
      )}
    >
      {/* 把 flex 布局放在 button 内部 wrapper，避开 webview 对 button
          默认 align-items 的覆盖 */}
      <span
        className={cn(
          "flex h-full w-full items-center gap-2",
          collapsed ? "justify-center" : "",
        )}
      >
        {/* svg 尺寸严格等于文字字号 14px */}
        <Icon
          className="h-3.5 w-3.5 shrink-0"
          aria-hidden="true"
          strokeWidth={2}
        />
        {/* 已加载本地 Noto Sans SC，默认行高即可正常对齐，
            同时保留 truncate 防止超长标签撑破布局。
            折叠态下隐藏文字，依靠 title 提供悬浮提示。 */}
        {!collapsed && <span className="truncate">{label}</span>}
      </span>
    </button>
  );
}
