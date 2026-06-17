/**
 * RoleToolbar（§8.x）
 *
 * ListPanel 顶部 toolbar。
 * - 左侧：UserCog 图标 + "Model Roles" 文字 + 数量徽章
 * - 右侧：+ 新建角色按钮
 */

import { Plus, UserCog } from "lucide-react";

import { useRoleStore } from "@/features/role/store";
import { cn } from "@/lib/utils";

export function RoleToolbar(): React.JSX.Element {
  const roles = useRoleStore((s) => s.roles);
  const createRole = useRoleStore((s) => s.createRole);
  const hasRoles = roles.length > 0;

  return (
    <div className="flex h-12 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-2">
        <UserCog className="h-4 w-4 text-muted" />
        <span className="text-sm font-medium text-foreground">Model Roles</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            hasRoles
              ? "bg-primary-soft text-primary-strong"
              : "bg-transparent text-muted",
          )}
        >
          {roles.length}
        </span>
      </div>

      <button
        type="button"
        onClick={() => void createRole()}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary-soft px-3 text-sm font-medium text-primary-strong transition-colors hover:bg-primary-tint"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>新建</span>
      </button>
    </div>
  );
}
