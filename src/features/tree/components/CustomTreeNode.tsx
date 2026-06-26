/**
 * CustomTreeNode（XYFlow 自定义节点，§5）
 *
 * 节点卡片：120x36，标题 + 元信息（时间）。
 * 层级图标：根📝 / 2层🔹 / 3层🔸 / 4层+○
 * 选中：左侧 3px 蓝色指示条
 * 悬停：右上角显示快捷图标（查看对话/添加子节点）+ 三点菜单
 *
 * 菜单使用 React Portal 渲染到 body，避免被 ReactFlow 容器裁剪。
 */

import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { createPortal } from "react-dom";
import {
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  MessageSquare,
  UserCog,
  Check,
} from "lucide-react";

import { useChatStore } from "@/features/chat/store";
import { useRoleStore } from "@/features/role/store";
import { useTreeViewStore } from "../store";
import type { TreeNodeData } from "../types/xyflow";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import type { Role } from "@/types/models";
import { AddChildDialog } from "./AddChildDialog";

const MENU_OFFSET = 4;
const NODE_WIDTH = 90;
const NODE_HEIGHT = 30;

/** 根据层级返回图标（设计文档 §4.4） */
function LevelIcon({ depth }: { depth: number }) {
  if (depth === 0) {
    return <span className="shrink-0 text-[6px]">📝</span>;
  }
  if (depth === 1) {
    return <span className="shrink-0 text-[6px]">🔹</span>;
  }
  if (depth === 2) {
    return <span className="shrink-0 text-[6px]">🔸</span>;
  }
  return <span className="shrink-0 text-[6px]">○</span>;
}

function CustomTreeNodeInner(props: NodeProps): React.JSX.Element {
  const data = props.data as unknown as TreeNodeData;
  const {
    label,
    isSelected,
    treeNodeId,
    roleId,
    updatedAt,
    depth,
  } = data;

  const currentChatId = useChatStore((s) => s.currentChatId);
  const isActive = currentChatId === treeNodeId;

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [roleSubOpen, setRoleSubOpen] = useState(false);
  const [submenuPos, setSubmenuPos] = useState<{ top: number; left: number } | null>(null);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [addChildLoading, setAddChildLoading] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const roles = useRoleStore((s) => s.roles);
  const setChatRole = useChatStore((s) => s.setChatRole);
  const setNodeRole = useTreeViewStore((s) => s.setNodeRole);

  const editingNodeId = useTreeViewStore((s) => s.editingNodeId);
  const editingTitle = useTreeViewStore((s) => s.editingTitle);
  const setEditingNode = useTreeViewStore((s) => s.setEditingNode);
  const setEditingTitle = useTreeViewStore((s) => s.setEditingTitle);
  const submitEditing = useTreeViewStore((s) => s.submitEditing);
  const cancelEditing = useTreeViewStore((s) => s.cancelEditing);
  const setSelectedNode = useTreeViewStore((s) => s.setSelectedNode);
  const createNode = useTreeViewStore((s) => s.createNode);
  const requestDelete = useTreeViewStore((s) => s.requestDelete);
  const viewChatForNode = useTreeViewStore((s) => s.viewChatForNode);

  const isEditing = editingNodeId === treeNodeId;

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  // click outside 关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        menuBtnRef.current?.contains(t) ||
        menuRef.current?.contains(t) ||
        submenuRef.current?.contains(t)
      ) {
        return;
      }
      setMenuOpen(false);
      setRoleSubOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => {
      setMenuOpen(false);
      setRoleSubOpen(false);
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuOpen]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
      setRoleSubOpen(false);
      return;
    }
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({
        top: rect.bottom + MENU_OFFSET,
        right: window.innerWidth - rect.right,
      });
    }
    setMenuOpen(true);
    setRoleSubOpen(false);
  };

  const openRoleSubmenu = () => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    setSubmenuPos({
      top: rect.top,
      left: rect.right + 2,
    });
    setRoleSubOpen(true);
  };

  const onSetRole = async (role: Role) => {
    await setChatRole(treeNodeId, role.id);
    await setNodeRole(treeNodeId, role.id);
    setMenuOpen(false);
    setRoleSubOpen(false);
  };

  const onAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setAddChildOpen(true);
  };

  const handleAddChildConfirm = async (title: string) => {
    setAddChildLoading(true);
    try {
      await createNode(title, treeNodeId);
      setAddChildOpen(false);
    } finally {
      setAddChildLoading(false);
    }
  };

  const onEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setEditingNode(treeNodeId);
  };

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    requestDelete(treeNodeId);
  };

  const onViewChat = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    await viewChatForNode(treeNodeId);
  };

  const commitEdit = async () => {
    await submitEditing();
  };

  const onNodeClick = () => {
    setSelectedNode(treeNodeId);
  };

  return (
    <div
      className={cn(
        "group relative flex cursor-pointer flex-col justify-center gap-0.5 rounded-[var(--radius)] border bg-background px-2 py-1",
        isSelected && "border-primary",
        isActive && !isSelected && depth > 0 && "border-primary bg-primary-soft",
        !isSelected && depth > 0 && "border-border hover:border-[#D1D5DB]",
        !isSelected && depth === 0 && "border-border hover:border-[#D1D5DB]",
      )}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      onClick={onNodeClick}
    >
      {/* 选中左侧指示条（设计文档 §5.3） */}
      {isSelected && (
        <span
          className="absolute left-0 top-0.5 bottom-0.5 w-[3px] rounded-r-[2px] bg-primary"
          aria-hidden="true"
        />
      )}

      <Handle type="target" position={Position.Top} className="!h-0 !w-0 !border-0 !opacity-0" />

      <div className="flex items-center gap-0.5">
        <LevelIcon depth={depth} />

        {/* 标题 / 编辑框 */}
        {isEditing ? (
          <input
            ref={inputRef}
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commitEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelEditing();
              }
            }}
            onBlur={() => void commitEdit()}
            className="min-w-0 flex-1 border-0 border-b border-primary bg-transparent text-[8px] font-medium text-foreground outline-none"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-[8px] font-medium leading-[1.4] text-foreground">
            {label}
          </span>
        )}
      </div>

      {/* 元信息 + 操作图标 */}
      {!isEditing && (
        <div className="flex items-center justify-between truncate text-[6px] text-[#9CA3AF]">
          <span>{formatRelativeTime(updatedAt)}</span>
          <div className="flex items-center gap-0.5 invisible group-hover:visible">
            <button
              type="button"
              aria-label="查看对话"
              onClick={onViewChat}
              className="inline-flex h-2.5 w-2.5 items-center justify-center rounded text-muted hover:text-foreground"
            >
              <MessageSquare className="h-2 w-2" />
            </button>
            <button
              ref={menuBtnRef}
              type="button"
              aria-label="更多操作"
              onClick={toggleMenu}
              className="inline-flex h-2.5 w-2.5 items-center justify-center rounded text-muted hover:text-foreground"
            >
              <MoreHorizontal className="h-2 w-2" />
            </button>
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!h-0 !w-0 !border-0 !opacity-0" />

      {/* 添加子节点对话框 */}
      <AddChildDialog
        open={addChildOpen}
        onOpenChange={setAddChildOpen}
        onConfirm={handleAddChildConfirm}
        loading={addChildLoading}
      />

      {/* 菜单 - Portal */}
      {menuOpen &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
            className="z-50 min-w-[140px] rounded-lg border border-border bg-background py-1 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 模型角色二级菜单入口 */}
            <div
              className="group/role relative flex cursor-pointer items-center justify-between px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-primary-hover"
              onMouseEnter={openRoleSubmenu}
              onMouseLeave={() => setRoleSubOpen(false)}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex items-center gap-2">
                <UserCog className="h-3 w-3 text-muted" />
                模型角色
              </span>
              <span className="text-[10px] text-muted">▶</span>
            </div>

            <div className="my-1 h-px bg-border" />

            <button
              type="button"
              onClick={onViewChat}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-primary-hover"
            >
              <MessageSquare className="h-3 w-3 text-muted" />
              查看对话
            </button>
            <button
              type="button"
              onClick={onAddChild}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-primary-hover"
            >
              <Plus className="h-3 w-3 text-muted" />
              添加子节点
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-primary-hover"
            >
              <Pencil className="h-3 w-3 text-muted" />
              重命名
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-error transition-colors hover:bg-primary-hover"
            >
              <Trash2 className="h-3 w-3" />
              删除
            </button>
          </div>,
          document.body,
        )}

      {/* 模型角色二级菜单 — Portal */}
      {roleSubOpen &&
        submenuPos &&
        createPortal(
          <div
            ref={submenuRef}
            style={{ position: "fixed", top: submenuPos.top, left: submenuPos.left }}
            className="z-50 min-w-[140px] rounded-lg border border-border bg-background py-1 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            onMouseEnter={() => setRoleSubOpen(true)}
            onMouseLeave={() => setRoleSubOpen(false)}
            onClick={(e) => e.stopPropagation()}
          >
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void onSetRole(role);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors hover:bg-primary-hover",
                  role.id === roleId ? "text-primary-strong" : "text-foreground",
                )}
              >
                <span>{role.name}</span>
                {role.id === roleId && <Check className="h-3 w-3" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export const CustomTreeNode = memo(CustomTreeNodeInner);
CustomTreeNode.displayName = "CustomTreeNode";
