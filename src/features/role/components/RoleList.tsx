/**
 * RoleList（§8.x）
 *
 * Role 列表容器：调 `roleStore.loadRoles()` 拉数据，渲染 `<RoleItem />`。
 * 注意：Header（RoleToolbar）由 ListPanel 统一控制，本组件只负责列表区。
 */

import { useEffect } from "react";
import { UserCog } from "lucide-react";

import { useRoleStore } from "@/features/role/store";

import { RoleItem } from "./RoleItem";
import { EmptyState } from "@/components/common/EmptyState";

export function RoleList(): React.JSX.Element {
  const roles = useRoleStore((s) => s.roles);
  const status = useRoleStore((s) => s.status);
  const loadRoles = useRoleStore((s) => s.loadRoles);

  useEffect(() => {
    if (status === "empty") {
      void loadRoles();
    }
  }, [status, loadRoles]);

  if (status === "loading" && roles.length === 0) {
    return <div className="p-4 text-xs text-muted">加载中…</div>;
  }

  if (status === "error") {
    return (
      <EmptyState
        icon={UserCog}
        title="加载失败"
        subtitle="请检查网络或重启应用"
      />
    );
  }

  if (roles.length === 0) {
    return (
      <EmptyState
        icon={UserCog}
        title="还没有角色"
        subtitle="点击右上角 + 新建角色"
      />
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-1 py-1">
      {roles.map((r) => (
        <RoleItem key={r.id} role={r} />
      ))}
    </ul>
  );
}
