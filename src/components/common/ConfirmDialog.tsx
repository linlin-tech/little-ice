/**
 * ConfirmDialog（§16.4）
 *
 * 使用 shadcn/ui 风格的 Dialog（基于 @radix-ui/react-dialog）
 * 替代 Tauri 系统 Dialog Plugin。
 *
 * 用法：
 * ```ts
 * if (await confirmDestructive("删除该 Chat？此操作不可撤销。")) {
 *   await deleteChat(id);
 * }
 * ```
 */

import { useState, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

// =============================================================
// 全局状态管理（单例模式）
// =============================================================

interface PendingConfirm {
  message: string;
  resolve: (value: boolean) => void;
}

let pendingConfirm: PendingConfirm | null = null;
let notifyOpen: (() => void) | null = null;

function setPendingConfirm(p: PendingConfirm | null) {
  pendingConfirm = p;
  notifyOpen?.();
}

function getPendingConfirm(): PendingConfirm | null {
  return pendingConfirm;
}

// =============================================================
// confirmDestructive：返回 Promise<boolean>
// =============================================================

/**
 * 危险操作二次确认。返回 `true` 表示用户点"确认删除"。
 *
 * @param message  正文描述（14px / 400，--text-secondary）
 */
export async function confirmDestructive(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    setPendingConfirm({ message, resolve });
  });
}

// =============================================================
// ConfirmDialog 组件（全局单例，在 App 顶层挂载一次）
// =============================================================

export function ConfirmDialog(): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  // 注册通知回调，当 confirmDestructive 被调用时打开对话框
  useState(() => {
    notifyOpen = () => {
      const pending = getPendingConfirm();
      if (pending) {
        setMessage(pending.message);
        setOpen(true);
      }
    };
    return () => {
      notifyOpen = null;
    };
  });

  const handleClose = useCallback((confirmed: boolean) => {
    const pending = getPendingConfirm();
    if (pending) {
      pending.resolve(confirmed);
      setPendingConfirm(null);
    }
    setOpen(false);
  }, []);

  if (!open) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && handleClose(false)}>
      <DialogPrimitive.Portal>
        {/* 遮罩 */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/40"
        />
        {/* 对话框内容 */}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-[420px] translate-x-[-50%] translate-y-[-50%] rounded-lg bg-background p-6 shadow-lg",
          )}
          onPointerDownOutside={() => handleClose(false)}
          onEscapeKeyDown={() => handleClose(false)}
        >
          {/* 标题 */}
          <DialogPrimitive.Title className="text-base font-semibold text-foreground">
            系统提示
          </DialogPrimitive.Title>

          {/* 关闭按钮 */}
          <DialogPrimitive.Close
            className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-primary-hover"
            onClick={() => handleClose(false)}
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          {/* 正文 */}
          <p className="mt-1 text-sm text-muted-foreground">
            {message}
          </p>

          {/* 按钮 */}
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => handleClose(false)}
              className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted transition-colors hover:bg-primary-hover"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => handleClose(true)}
              className="inline-flex h-8 items-center rounded-md bg-error px-3 text-sm font-medium text-white transition-colors hover:bg-error/90"
            >
              确定
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
