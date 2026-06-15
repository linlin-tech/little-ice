/**
 * InlineMessage（§17.2）
 *
 * 统一的行内提示组件，**不弹窗**，紧贴触发处。3 种类别：
 * - `success` 绿
 * - `error`   红
 * - `info`    蓝
 *
 * 用法：
 * ```tsx
 * <InlineMessage kind="success" text={`已保存 · 14:23`} />
 * <InlineMessage kind="error" text={error} />
 * ```
 */

import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

export type InlineMessageKind = "success" | "error" | "info";

interface InlineMessageProps {
  kind: InlineMessageKind;
  text: string;
  className?: string;
}

export function InlineMessage({
  kind,
  text,
  className,
}: InlineMessageProps): React.JSX.Element {
  const Icon = iconFor(kind);
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      className={cn(
        "flex items-center gap-1.5 text-xs",
        colorFor(kind),
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

function iconFor(kind: InlineMessageKind) {
  switch (kind) {
    case "success":
      return CheckCircle2;
    case "error":
      return AlertCircle;
    case "info":
      return Info;
  }
}

function colorFor(kind: InlineMessageKind): string {
  switch (kind) {
    case "success":
      return "text-success";
    case "error":
      return "text-error";
    case "info":
      return "text-primary-strong";
  }
}
