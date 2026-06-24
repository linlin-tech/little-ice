/**
 * MessageMarkdown（§14.2）
 *
 * AI 消息的 Markdown 渲染。
 *
 * 复用通用 MarkdownRenderer 以保持与收藏区预览一致。
 */

import { MarkdownRenderer } from "@/components/common/MarkdownRenderer";

interface MessageMarkdownProps {
  content: string;
}

export function MessageMarkdown({
  content,
}: MessageMarkdownProps): React.JSX.Element {
  return <MarkdownRenderer content={content} />;
}
