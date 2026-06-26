/**
 * TreeEmptyState（空状态：无任何话题）
 */

import { TreePine } from "lucide-react";

interface TreeEmptyStateProps {
  onCreateRoot: () => void;
}

export function TreeEmptyState({ onCreateRoot }: TreeEmptyStateProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <TreePine className="h-16 w-16" />
      <h3 className="text-lg font-medium">还没有任何节点</h3>
      <p className="text-sm">创建第一个对话</p>
      <button
        type="button"
        onClick={onCreateRoot}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary-soft px-3 text-sm font-medium text-primary-strong transition-colors hover:bg-primary-tint"
      >
        创建第一个对话
      </button>
    </div>
  );
}
