/**
 * MessageMarkdown（§14.2）
 *
 * AI 消息的 Markdown 渲染：react-markdown + remark-gfm + rehype-highlight。
 *
 * 样式通过 Tailwind 的 `prose`-like 自定义类映射，参照设计系统 §14.2：
 * - 段落间距舒适
 * - 标题层级分明
 * - 代码块/引用/列表/链接等均有精致样式
 */

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

interface MessageMarkdownProps {
  content: string;
}

export function MessageMarkdown({
  content,
}: MessageMarkdownProps): React.JSX.Element {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
