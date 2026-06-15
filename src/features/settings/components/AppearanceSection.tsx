/**
 * AppearanceSection（§22）
 *
 * MVP 暂不支持切换：
 * - Light 选中（disabled 状态 + primary 边框）
 * - Dark  灰显（disabled 状态 + muted 文字）
 *
 * 两个选项都用 `disabled` button，不能点，cursor-not-allowed。
 */

import { Check, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

export function AppearanceSection(): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">外观</h3>
      </div>
      <p className="text-xs text-muted">当前主题：Light（MVP 暂不支持切换）</p>

      <div className="mt-2 flex flex-wrap gap-2">
        <ThemeOption label="浅色" icon={Sun} active disabled />
        <ThemeOption label="深色" icon={Moon} active={false} disabled />
      </div>
    </div>
  );
}

interface ThemeOptionProps {
  label: string;
  icon: typeof Sun;
  active: boolean;
  disabled: boolean;
}

function ThemeOption({
  label,
  icon: Icon,
  active,
  disabled,
}: ThemeOptionProps): React.JSX.Element {
  return (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={active}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
          // active = primary-tint 背景 + primary 边框 + primary-strong 文字 + 选中对勾
          active
            ? "border-primary bg-primary-tint text-primary-strong"
            : "border-border bg-background text-muted",
          disabled && "cursor-not-allowed",
        )}
      >
        {/* 图标 h-4 与 text-sm(14) 略大但 align-middle 迫其中心与文字 x-height 对齐 */}
        <Icon className="h-4 w-4 align-middle" aria-hidden="true" />
        <span className="align-middle">{label}</span>
        {active && <Check className="h-3.5 w-3.5 align-middle" aria-hidden="true" />}
      </button>
  );
}
