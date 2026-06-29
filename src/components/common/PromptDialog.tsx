/**
 * PromptDialog
 *
 * 使用与 ConfirmDialog 一致的 shadcn/ui 风格 Dialog（基于 @radix-ui/react-dialog）
 * 替代原生 window.prompt，用于需要用户输入字符串的场景。
 *
 * 用法：
 * ```ts
 * const name = await promptInput("新建分组", "新分组");
 * if (name) {
 *   await createGroup("chat", name);
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

interface PendingPrompt {
  title: string;
  defaultValue: string;
  resolve: (value: string | null) => void;
}

let pendingPrompt: PendingPrompt | null = null;
let notifyOpen: (() => void) | null = null;

function setPendingPrompt(p: PendingPrompt | null) {
  pendingPrompt = p;
  notifyOpen?.();
}

function getPendingPrompt(): PendingPrompt | null {
  return pendingPrompt;
}

// =============================================================
// promptInput：返回 Promise<string | null>
// =============================================================

/**
 * 弹出输入框。返回用户确认的字符串（已 trim），取消或留空时返回 `null`。
 *
 * @param title        对话框标题
 * @param defaultValue 输入框默认值
 */
export async function promptInput(
  title: string,
  defaultValue = "",
): Promise<string | null> {
  return new Promise((resolve) => {
    setPendingPrompt({ title, defaultValue, resolve });
  });
}

// =============================================================
// PromptDialog 组件（全局单例，在 App 顶层挂载一次）
// =============================================================

export function PromptDialog(): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");

  // 注册通知回调，当 promptInput 被调用时打开对话框
  useState(() => {
    notifyOpen = () => {
      const pending = getPendingPrompt();
      if (pending) {
        setTitle(pending.title);
        setValue(pending.defaultValue);
        setOpen(true);
      }
    };
    return () => {
      notifyOpen = null;
    };
  });

  const handleClose = useCallback(
    (confirmed: boolean) => {
      const pending = getPendingPrompt();
      if (pending) {
        if (confirmed) {
          const trimmed = value.trim();
          pending.resolve(trimmed || null);
        } else {
          pending.resolve(null);
        }
        setPendingPrompt(null);
      }
      setOpen(false);
      setValue("");
    },
    [value],
  );

  if (!open) return null;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(v) => !v && handleClose(false)}
    >
      <DialogPrimitive.Portal>
        {/* 遮罩 */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />

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
            {title}
          </DialogPrimitive.Title>

          {/* 关闭按钮 */}
          <DialogPrimitive.Close
            className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-primary-hover"
            onClick={() => handleClose(false)}
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          {/* 输入框 */}
          <div className="mt-4">
            <input
              type="text"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleClose(true);
                }
              }}
              placeholder="请输入名称"
              className={cn(
                "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted",
                "focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong",
              )}
            />
          </div>

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
              className="inline-flex h-8 items-center rounded-md bg-primary-strong px-3 text-sm font-medium text-white transition-colors hover:bg-primary-strong/90"
            >
              确定
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
