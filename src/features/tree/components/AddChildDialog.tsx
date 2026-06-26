/**
 * AddChildDialog（添加子节点对话框）
 *
 * 使用 @radix-ui/react-dialog + react-hook-form 替代 window.prompt。
 * 支持：
 * - 表单验证（非空、最大长度 50）
 * - Enter 提交 / Escape 关闭
 * - 打开时自动聚焦输入框
 * - 加载态禁用按钮
 */

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

interface FormValues {
  title: string;
}

interface AddChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (title: string) => void;
  loading?: boolean;
}

export function AddChildDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: AddChildDialogProps): React.JSX.Element | null {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { title: "" },
  });

  const inputRef = useRef<HTMLInputElement>(null);

  // 打开时重置表单并聚焦
  useEffect(() => {
    if (open) {
      reset({ title: "" });
      // 短暂延迟确保 DOM 渲染完成后聚焦
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, reset]);

  const onSubmit = (data: FormValues) => {
    if (data.title.trim()) {
      onConfirm(data.title.trim());
    }
  };

  if (!open) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-[420px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-background p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
          )}
          onPointerDownOutside={() => onOpenChange(false)}
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          <DialogPrimitive.Title className="flex items-center gap-3 text-base font-semibold text-foreground">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Plus className="h-5 w-5 text-primary" />
            </span>
            添加子节点
          </DialogPrimitive.Title>

          <DialogPrimitive.Close
            className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-primary-hover"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-5">
            <div className="space-y-2">
              <label
                htmlFor="add-child-title"
                className="text-sm font-medium text-foreground"
              >
                节点名称
              </label>
              <input
                id="add-child-title"
                type="text"
                placeholder="请输入子节点名称"
                disabled={loading}
                className={cn(
                  "h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted",
                  errors.title
                    ? "border-error focus:border-error focus:ring-1 focus:ring-error"
                    : "border-border focus:border-primary focus:ring-1 focus:ring-primary",
                )}
                {...register("title", {
                  required: "请输入节点名称",
                  maxLength: {
                    value: 50,
                    message: "节点名称最多 50 个字符",
                  },
                })}
                ref={(e) => {
                  register("title").ref(e);
                  (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = e;
                }}
              />
              {errors.title && (
                <p className="text-xs text-error">{errors.title.message}</p>
              )}
            </div>

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
                type="submit"
                disabled={loading}
                className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "创建中…" : "确认"}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
