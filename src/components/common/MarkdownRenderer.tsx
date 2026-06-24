/**
 * MarkdownRenderer
 *
 * 统一的 Markdown 渲染组件：对话区与收藏区预览共用同一套样式。
 *
 * 渲染栈：react-markdown + remark-gfm + rehype-highlight。
 */

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

export const markdownRendererClassName = [
  "prose prose-sm max-w-none",
  // 段落 / 标题 / 列表
  "[&>p]:my-3",
  "[&>h1]:mt-6 [&>h1]:mb-2 [&>h1]:text-xl [&>h1]:font-semibold",
  "[&>h2]:mt-5 [&>h2]:mb-2 [&>h2]:text-base [&>h2]:font-semibold",
  "[&>h3]:mt-4 [&>h3]:mb-1 [&>h3]:text-sm [&>h3]:font-semibold",
  "[&>ul]:my-2 [&>ul]:list-disc [&>ul]:pl-6",
  "[&>ol]:my-2 [&>ol]:list-decimal [&>ol]:pl-6",
  "[&>li]:my-1",
  // 行内代码 / 代码块
  "[&>code]:bg-primary-soft [&>code]:text-primary-strong [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:font-mono [&>code]:text-[0.85em]",
  "[&>pre]:bg-sidebar [&>pre]:rounded-md [&>pre]:p-4 [&>pre]:my-3 [&>pre]:overflow-x-auto",
  "[&>pre>code]:bg-transparent [&>pre>code]:p-0",
  // 引用
  "[&>blockquote]:border-l-4 [&>blockquote]:border-primary [&>blockquote]:pl-3 [&>blockquote]:my-3 [&>blockquote]:text-muted",
  // 链接 / 强调
  "[&>a]:text-primary-strong [&>a]:underline",
  "[&>strong]:font-semibold",
  "[&>em]:italic",
  "[&>hr]:my-4 [&>hr]:border-border",
  "[&_code]:bg-primary-soft [&_code]:text-primary-strong [&_code]:px-1 [&_code]:rounded",
].join(" ");

export function MarkdownRenderer({
  content,
}: MarkdownRendererProps): React.JSX.Element {
  return (
    <div className={markdownRendererClassName}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
