/**
 * LoadingDots（§19.2）
 *
 * 3 个 4px 圆点，1.2s 循环（staggered animation-delay）。
 * 严格按 §19.2 CSS 规格。
 *
 * 用法：
 * ```tsx
 * <LoadingDots />                   // 默认 muted 颜色
 * <LoadingDots className="..." />   // 自定义容器样式
 * ```
 */

import { cn } from "@/lib/utils";

interface LoadingDotsProps {
  className?: string;
  "aria-label"?: string;
}

export function LoadingDots({
  className,
  "aria-label": ariaLabel = "加载中",
}: LoadingDotsProps): React.JSX.Element {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-[3px]", className)}
    >
      <span className="li-dot" />
      <span className="li-dot" />
      <span className="li-dot" />
    </span>
  );
}
