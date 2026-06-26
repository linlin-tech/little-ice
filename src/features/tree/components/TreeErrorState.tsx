/**
 * TreeErrorState（错误状态）
 */

import { AlertTriangle } from "lucide-react";

interface TreeErrorStateProps {
  error: string;
  onRetry: () => void;
}

export function TreeErrorState({ error, onRetry }: TreeErrorStateProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-error">
      <AlertTriangle className="h-16 w-16" />
      <h3 className="text-lg font-medium">加载失败</h3>
      <p className="text-sm text-muted-foreground">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-primary-hover"
      >
        重新加载
      </button>
    </div>
  );
}
