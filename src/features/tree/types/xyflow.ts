/**
 * @xyflow/react 数据适配层
 *
 * 将 TreeNode 数据转换为 XYFlow 的 Node/Edge 结构。
 */

import type { Edge, Node } from "@xyflow/react";

import type { Id, TreeNodeWithChildren } from "@/types/models";

// =============================================================
// XYFlow 自定义节点类型
// =============================================================

/** 自定义节点 data 字段类型 */
export type TreeNodeData = {
  label: string;
  treeNodeId: Id;
  roleId: Id;
  childCount: number;
  isRoot: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  /** 最后活跃时间（Unix ms） */
  updatedAt: number;
  /** 层级深度（根=0） */
  depth: number;
};

export type TreeNodeFlowNode = Node<TreeNodeData, "treeNode">;
export type TreeNodeFlowEdge = Edge;

// =============================================================
// 转换函数
// =============================================================

export function treeNodeToFlowNode(
  tn: TreeNodeWithChildren,
  expandedIds: Set<Id>,
  selectedId: Id | null,
  depth: number,
): TreeNodeFlowNode {
  return {
    id: tn.id,
    type: "treeNode",
    position: { x: 0, y: 0 },
    data: {
      label: tn.title,
      treeNodeId: tn.id,
      roleId: tn.roleId,
      childCount: tn.childCount,
      isRoot: tn.parentId === null,
      isSelected: tn.id === selectedId,
      isExpanded: expandedIds.has(tn.id),
      updatedAt: tn.updatedAt,
      depth,
    },
  };
}

export function treeNodesToFlowEdges(
  parentId: Id,
  children: TreeNodeWithChildren[],
): TreeNodeFlowEdge[] {
  return children.map((child) => ({
    id: `${parentId}->${child.id}`,
    source: parentId,
    target: child.id,
    type: "smoothstep",
    animated: false,
  }));
}
