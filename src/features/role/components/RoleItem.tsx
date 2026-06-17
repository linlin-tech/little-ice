/**
 * RoleItem（§13）
 *
 * 单个 role 列表项：
 * - 容器：mx-2 rounded-md px-4 py-3 cursor-pointer
 * - Hover 时显示删除按钮（非系统角色）
 * - 点击选中
 */

import { Trash2 } from "lucide-react";

import { useRoleStore } from "@/features/role/store";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/models";

import { confirmDestructive } from "@/components/common/ConfirmDialog";

interface RoleItemProps {
  role: Role;
}

export function RoleItem({ role }: RoleItemProps): React.JSX.Element {
  const selectedRoleId = useRoleStore((s) => s.selectedRoleId);
  const selectRole = useRoleStore((s) => s.selectRole);
  const deleteRole = useRoleStore((s) => s.deleteRole);

  const selected = selectedRoleId === role.id;

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirmDestructive(
      role.isBuiltin
        ? "系统内置角色不可删除"
        : `要删除角色「${role.name}」吗？`,
    );
    if (ok && !role.isBuiltin) await deleteRole(role.id);
  };

  return (
    <li
      onClick={() => selectRole(role.id)}
      className={cn(
        "group relative mx-2 cursor-pointer rounded-md px-4 py-3 text-sm transition-colors",
        selected
          ? "border-l-[3px] border-primary bg-primary-soft"
          : "border-l-[3px] border-transparent hover:bg-primary-hover",
      )}
    >
      <div className="truncate pr-[40px] text-sm font-medium text-foreground">
        {role.name}
      </div>

      {!role.isBuiltin && (
        <div
          className={cn(
            "absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
            selected && "opacity-100",
          )}
        >
          <button
            type="button"
            aria-label="删除"
            onClick={onDelete}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-background hover:text-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}
