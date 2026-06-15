/**
 * BlinkingCursor（§19.1 generating 状态）
 *
 * AI 消息流式生成末尾的 `▍` 光标，1s 闪烁（stepped 动画模拟真实终端光标）。
 * CSS 实现在 `globals.css` 的 `.li-cursor` 工具类。
 *
 * 用法：
 * ```tsx
 * <p>正在生成内容...<BlinkingCursor /></p>
 * ```
 */

import { cn } from "@/lib/utils";

interface BlinkingCursorProps {
  className?: string;
}

export function BlinkingCursor({
  className,
}: BlinkingCursorProps): React.JSX.Element {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={cn("li-cursor", className)}
    />
  );
}
