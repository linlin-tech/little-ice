/**
 * EmptyState（§8.1 公共）
 *
 * 列表/内容为空时展示：居中图标 + 文字。
 *
 * 用法：
 * ```tsx
 * <EmptyState icon={<MessageSquare />} title="还没有对话" subtitle="点击 New Chat 开始" />
 * ```
 */

import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** 选填：右侧操作（如 New Chat 按钮） */
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <Icon className="h-10 w-10 text-muted" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {subtitle !== undefined && (
        <p className="text-xs text-muted">{subtitle}</p>
      )}
      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  );
}
