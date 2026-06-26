/**
 * DeleteNodeDialog（删除节点确认对话框）
 *
 * 基于 @radix-ui/react-dialog（与项目现有 ConfirmDialog 一致的技术栈）。
 *
 * 区分根节点 / 子节点两种文案：
 * - 根节点：删除整个话题（所有节点 + 子节点 + 对话记录）
 * - 子节点：删除该节点及子节点（递归）+ 关联对话记录
 */

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, X } from "lucide-react";

import { cn } from "@/lib/utils";

interface DeleteNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeTitle: string;
  childCount: number;
  isRoot: boolean;
  onConfirm: () => void;
  loading?: boolean;
}

export function DeleteNodeDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: DeleteNodeDialogProps): React.JSX.Element | null {
  if (!open) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-[440px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-background p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
          )}
          onPointerDownOutside={() => onOpenChange(false)}
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          <DialogPrimitive.Title className="flex items-center gap-3 text-base font-semibold text-foreground">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-error/10">
              <AlertTriangle className="h-5 w-5 text-error" />
            </span>
            "删除这个节点？"
          </DialogPrimitive.Title>

          <DialogPrimitive.Close
            className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-primary-hover"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          <DialogPrimitive.Description className="mt-4 text-sm text-muted-foreground">
            <p className="text-foreground">
              删除后，该节点及其所有子节点将被永久删除。
            </p>
          </DialogPrimitive.Description>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex h-8 items-center rounded-md border border-error bg-background px-3 text-sm font-medium text-error transition-colors hover:bg-error/10 disabled:opacity-50"
            >
              {loading ? "删除中…" : "删除"}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
