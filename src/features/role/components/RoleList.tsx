/**
 * RoleList（§8.x）
 *
 * Role 列表容器：调 `roleStore.loadRoles()` 拉数据，按分组渲染 `<RoleItem />`。
 * 注意：Header（RoleToolbar）由 ListPanel 统一控制，本组件只负责列表区。
 */

import { useEffect } from "react";
import { UserCog } from "lucide-react";

import { GroupedList } from "@/features/group/components/GroupedList";
import { useRoleStore } from "@/features/role/store";

import { EmptyState } from "@/components/common/EmptyState";
import { RoleItem } from "./RoleItem";

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

  return (
    <GroupedList
      resourceType="role"
      items={roles}
      renderItem={(role) => <RoleItem key={role.id} role={role} />}
      emptyState={
        <EmptyState
          icon={UserCog}
          title="还没有角色"
          subtitle="点击右上角 + 新建角色"
        />
      }
      resourceLabel="角色"
    />
  );
}
