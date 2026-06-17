/**
 * RoleDetail（§8.x）
 *
 * 右侧详情区：
 * - 名称输入框
 * - 职责 textarea
 * - 保存按钮（非系统角色可用）
 *
 * 系统角色：只读显示，隐藏保存按钮。
 */

import { useEffect, useState } from "react";
import { UserCog } from "lucide-react";

import { useRoleStore } from "@/features/role/store";
import { cn } from "@/lib/utils";

import { EmptyState } from "@/components/common/EmptyState";

export function RoleDetail(): React.JSX.Element {
  const selectedRoleId = useRoleStore((s) => s.selectedRoleId);
  const roles = useRoleStore((s) => s.roles);
  const updateRole = useRoleStore((s) => s.updateRole);

  const role = roles.find((r) => r.id === selectedRoleId) ?? null;

  const [name, setName] = useState(role?.name ?? "");
  const [responsibility, setResponsibility] = useState(role?.responsibility ?? "");

  useEffect(() => {
    setName(role?.name ?? "");
    setResponsibility(role?.responsibility ?? "");
  }, [role?.id, role?.name, role?.responsibility]);

  if (role === null || selectedRoleId === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={UserCog}
          title="还未选中任何角色"
          subtitle="从左侧列表选一个"
        />
      </div>
    );
  }

  const readOnly = role.isBuiltin;
  const changed = name !== role.name || responsibility !== role.responsibility;

  const onSave = async () => {
    if (readOnly) return;
    const nextName = name.trim();
    if (nextName.length === 0) return;
    await updateRole(role.id, nextName, responsibility);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-4 border-b border-border px-6 py-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            readOnly={readOnly}
            className={cn(
              "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none",
              readOnly
                ? "cursor-not-allowed border-border bg-sidebar"
                : "border-border focus:border-primary focus:ring-2 focus:ring-primary/15",
            )}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 px-6 py-4">
        <label className="mb-1.5 block text-xs font-medium text-muted">职责</label>
        <textarea
          value={responsibility}
          onChange={(e) => setResponsibility(e.target.value)}
          readOnly={readOnly}
          placeholder="请输入该角色的 System Prompt…"
          className={cn(
            "h-full w-full resize-none rounded-md border bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none",
            readOnly
              ? "cursor-not-allowed border-border bg-sidebar"
              : "border-border focus:border-primary focus:ring-2 focus:ring-primary/15",
          )}
        />
      </div>

      {!readOnly && (
        <div className="shrink-0 border-t border-border px-6 py-4">
          {/* 保存按钮靠右对齐（与 Form 提交操作位置一致） */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={!changed}
              className={cn(
                "inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition-colors",
                changed
                  ? "bg-primary-strong text-primary-foreground hover:bg-primary-strong/90"
                  : "cursor-not-allowed bg-border text-muted",
              )}
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
