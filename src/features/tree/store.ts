/**
 * treeViewStore（思维树图状态管理）
 *
 * 负责：
 * - 加载所有 tree nodes（扁平列表，前端构建树）
 * - 维护 XYFlow 的 nodes/edges（由 buildFlowData 从 allNodes + expandedIds 派生）
 * - 节点选中 / 展开 / 编辑 / 删除确认对话框状态
 * - CRUD：createNode / renameNode / deleteNode / setRole / moveNode
 */

import { create } from "zustand";

import { useAppStore } from "@/stores/appStore";
import { useChatStore } from "@/features/chat/store";
import { tauri } from "@/lib/tauri";
import type {
  Id,
  ResourceStatus,
  TreeNode,
  TreeNodeWithChildren,
} from "@/types/models";

import {
  type TreeNodeFlowEdge,
  type TreeNodeFlowNode,
  treeNodeToFlowNode,
} from "./types/xyflow";

// =============================================================
// 类型定义
// =============================================================

interface DeleteDialogState {
  nodeId: Id;
  nodeTitle: string;
  isRoot: boolean;
  childCount: number;
}

interface TreeViewState {
  // 数据源
  allNodes: Map<Id, TreeNodeWithChildren>;
  rootNodeIds: Id[];

  // XYFlow 状态（派生数据）
  flowNodes: TreeNodeFlowNode[];
  flowEdges: TreeNodeFlowEdge[];
  selectedNodeId: Id | null;

  // 交互状态
  expandedNodeIds: Set<Id>;
  editingNodeId: Id | null;
  editingTitle: string;
  deleteDialog: DeleteDialogState | null;

  // 加载状态
  status: ResourceStatus;
  error: string | null;
  childrenLoading: Set<Id>;
  deleting: boolean;

  // Actions - 数据加载
  loadAllNodes: () => Promise<void>;
  loadChildren: (parentId: Id) => Promise<void>;

  // Actions - 交互
  setSelectedNode: (nodeId: Id | null) => void;
  toggleExpand: (nodeId: Id) => void;
  setEditingNode: (nodeId: Id | null) => void;
  setEditingTitle: (title: string) => void;
  submitEditing: () => Promise<void>;
  cancelEditing: () => void;
  setDeleteDialog: (dialog: DeleteDialogState | null) => void;
  requestDelete: (nodeId: Id) => void;
  confirmDelete: () => Promise<void>;

  // Actions - CRUD
  createNode: (
    title: string,
    parentId: Id | null,
    roleId?: Id | null,
  ) => Promise<TreeNode | null>;
  renameNode: (nodeId: Id, title: string) => Promise<void>;
  setNodeRole: (nodeId: Id, roleId: Id) => Promise<void>;
  moveNode: (
    nodeId: Id,
    newParentId: Id | null,
    newOrder: number,
  ) => Promise<void>;

  // Actions - 视图切换
  rebuildForCurrentChat: () => void;
  viewChatForNode: (nodeId: Id) => Promise<void>;

  // Utility
  clearError: () => void;
}

// =============================================================
// 辅助函数：构建 XYFlow 数据
// =============================================================

function buildFlowData(
  allNodes: Map<Id, TreeNodeWithChildren>,
  expandedIds: Set<Id>,
  selectedId: Id | null,
): { nodes: TreeNodeFlowNode[]; edges: TreeNodeFlowEdge[] } {
  const nodes: TreeNodeFlowNode[] = [];
  const edges: TreeNodeFlowEdge[] = [];

  // 只渲染当前选中对话所属的那棵树（从 selectedId 往上找根祖先）
  if (!selectedId) return { nodes, edges };
  const rootId = findRootAncestor(selectedId, allNodes);
  if (!rootId) return { nodes, edges };
  const root = allNodes.get(rootId);
  if (!root) return { nodes, edges };

  function traverse(nodeId: Id, depth: number) {
    const node = allNodes.get(nodeId);
    if (!node) return;

    nodes.push(treeNodeToFlowNode(node, expandedIds, selectedId, depth));

    if (expandedIds.has(nodeId)) {
      const children = Array.from(allNodes.values())
        .filter((n) => n.parentId === nodeId)
        .sort((a, b) => a.order - b.order);

      for (const child of children) {
        edges.push({
          id: `${nodeId}->${child.id}`,
          source: nodeId,
          target: child.id,
          type: "smoothstep",
          animated: false,
        });
        traverse(child.id, depth + 1);
      }
    }
  }

  traverse(rootId, 0);

  return { nodes, edges };
}

function computeRootNodeIds(allNodes: Map<Id, TreeNodeWithChildren>): Id[] {
  return Array.from(allNodes.values())
    .filter((n) => n.parentId === null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((n) => n.id);
}

function collectDescendantsLocal(
  rootId: Id,
  allNodes: Map<Id, TreeNodeWithChildren>,
): Id[] {
  const result: Id[] = [rootId];
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const node of allNodes.values()) {
      if (node.parentId === current) {
        result.push(node.id);
        stack.push(node.id);
      }
    }
  }
  return result;
}

function currentChatIdNow(): Id | null {
  return useChatStore.getState().currentChatId;
}

/** 从给定节点 id 往上找最顶层根节点 id（parentId === null） */
function findRootAncestor(
  nodeId: Id,
  allNodes: Map<Id, TreeNodeWithChildren>,
): Id | null {
  let current: Id | null = nodeId;
  let guard = 0;
  while (current !== null && guard < 1000) {
    guard++;
    const node = allNodes.get(current);
    if (!node) return null;
    if (node.parentId === null) return current;
    current = node.parentId;
  }
  return current;
}

function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}

// =============================================================
// Store
// =============================================================

export const useTreeViewStore = create<TreeViewState>()((set, get) => ({
  allNodes: new Map(),
  rootNodeIds: [],

  flowNodes: [],
  flowEdges: [],
  selectedNodeId: null,

  expandedNodeIds: new Set(),
  editingNodeId: null,
  editingTitle: "",
  deleteDialog: null,

  status: "empty",
  error: null,
  childrenLoading: new Set(),
  deleting: false,

  // ===== 数据加载 =====

  loadAllNodes: async () => {
    set({ status: "loading", error: null });
    try {
      const nodes = await tauri.listAllTreeNodes();
      const allNodes = new Map<Id, TreeNodeWithChildren>();
      for (const n of nodes) {
        allNodes.set(n.id, n);
      }
      const rootNodeIds = computeRootNodeIds(allNodes);
      const expandedNodeIds = new Set(get().expandedNodeIds);
      // 默认展开当前选中对话的根节点
      const curId = currentChatIdNow();
      if (curId) {
        // 展开从根到当前节点的整条路径
        let cur: Id | null = curId;
        let guard = 0;
        while (cur !== null && guard < 1000) {
          guard++;
          expandedNodeIds.add(cur);
          const n = allNodes.get(cur);
          cur = n?.parentId ?? null;
        }
      }
      set({
        allNodes,
        rootNodeIds,
        expandedNodeIds,
        selectedNodeId: curId,
        status: "ready",
        error: null,
      });
      const { nodes: flowNodes, edges: flowEdges } = buildFlowData(
        allNodes,
        expandedNodeIds,
        curId,
      );
      set({ flowNodes, flowEdges });
    } catch (e) {
      set({ status: "error", error: toMessage(e) });
    }
  },

  loadChildren: async (parentId) => {
    const childrenLoading = new Set(get().childrenLoading);
    childrenLoading.add(parentId);
    set({ childrenLoading });
    try {
      const children = await tauri.listTreeChildren(parentId);
      const allNodes = new Map(get().allNodes);
      for (const c of children) {
        allNodes.set(c.id, c);
      }
      const rootNodeIds = computeRootNodeIds(allNodes);
      set({ allNodes, rootNodeIds });
      const { nodes: flowNodes, edges: flowEdges } = buildFlowData(
        allNodes,
        get().expandedNodeIds,
        get().selectedNodeId,
      );
      set({ flowNodes, flowEdges });
    } catch (e) {
      set({ error: toMessage(e) });
    } finally {
      const cl = new Set(get().childrenLoading);
      cl.delete(parentId);
      set({ childrenLoading: cl });
    }
  },

  // ===== 交互 =====

  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
    const { nodes, edges } = buildFlowData(
      get().allNodes,
      get().expandedNodeIds,
      nodeId,
    );
    set({ flowNodes: nodes, flowEdges: edges });
  },

  toggleExpand: (nodeId) => {
    const expandedNodeIds = new Set(get().expandedNodeIds);
    if (expandedNodeIds.has(nodeId)) {
      expandedNodeIds.delete(nodeId);
    } else {
      expandedNodeIds.add(nodeId);
    }
    set({ expandedNodeIds });
    const { nodes, edges } = buildFlowData(
      get().allNodes,
      expandedNodeIds,
      get().selectedNodeId,
    );
    set({ flowNodes: nodes, flowEdges: edges });
  },

  setEditingNode: (nodeId) => {
    const node = nodeId ? get().allNodes.get(nodeId) : null;
    set({
      editingNodeId: nodeId,
      editingTitle: node ? node.title : "",
    });
  },

  setEditingTitle: (title) => set({ editingTitle: title }),

  submitEditing: async () => {
    const { editingNodeId, editingTitle } = get();
    if (!editingNodeId) return;
    const trimmed = editingTitle.trim();
    if (trimmed.length === 0) {
      set({ editingNodeId: null });
      return;
    }
    const node = get().allNodes.get(editingNodeId);
    if (node && trimmed !== node.title) {
      try {
        await tauri.renameTreeNode(editingNodeId, trimmed);
        const allNodes = new Map(get().allNodes);
        allNodes.set(editingNodeId, { ...node, title: trimmed });
        set({ allNodes });
        const { nodes, edges } = buildFlowData(
          allNodes,
          get().expandedNodeIds,
          get().selectedNodeId,
        );
        set({ flowNodes: nodes, flowEdges: edges });
      } catch (e) {
        set({ error: toMessage(e) });
      }
    }
    set({ editingNodeId: null, editingTitle: "" });
  },

  cancelEditing: () => set({ editingNodeId: null, editingTitle: "" }),

  setDeleteDialog: (dialog) => set({ deleteDialog: dialog }),

  requestDelete: (nodeId) => {
    const node = get().allNodes.get(nodeId);
    if (!node) return;
    set({
      deleteDialog: {
        nodeId,
        nodeTitle: node.title,
        isRoot: node.parentId === null,
        childCount: node.childCount,
      },
    });
  },

  confirmDelete: async () => {
    const dialog = get().deleteDialog;
    if (!dialog) return;
    set({ deleting: true, error: null });
    try {
      await tauri.deleteTreeNode(dialog.nodeId);
      const allNodes = new Map(get().allNodes);
      const toRemove = collectDescendantsLocal(dialog.nodeId, allNodes);
      for (const id of toRemove) {
        allNodes.delete(id);
      }
      // 更新父节点 childCount
      const deletedNode = get().allNodes.get(dialog.nodeId);
      if (deletedNode && deletedNode.parentId) {
        const parent = allNodes.get(deletedNode.parentId);
        if (parent) {
          allNodes.set(deletedNode.parentId, {
            ...parent,
            childCount: Math.max(0, parent.childCount - 1),
          });
        }
      }
      const rootNodeIds = computeRootNodeIds(allNodes);
      const newSelectedId =
        get().selectedNodeId === dialog.nodeId ? null : get().selectedNodeId;
      set({
        allNodes,
        rootNodeIds,
        selectedNodeId: newSelectedId,
        deleteDialog: null,
      });
      const { nodes, edges } = buildFlowData(
        allNodes,
        get().expandedNodeIds,
        newSelectedId,
      );
      set({ flowNodes: nodes, flowEdges: edges });

      // 同步 chatStore：刷新 chats 列表（删除的记录会消失）
      await useChatStore.getState().loadChats();
      // 若删除的是当前选中 chat，清空
      if (useChatStore.getState().currentChatId === dialog.nodeId) {
        await useChatStore.getState().selectChat(null);
      }
    } catch (e) {
      set({ error: toMessage(e) });
    } finally {
      set({ deleting: false });
    }
  },

  // ===== CRUD =====

  createNode: async (title, parentId, roleId = null) => {
    try {
      const newNode = await tauri.createTreeNode(title, parentId, roleId);
      const full = await tauri.getTreeNode(newNode.id);
      const allNodes = new Map(get().allNodes);
      allNodes.set(newNode.id, full);
      if (parentId) {
        const parent = allNodes.get(parentId);
        if (parent) {
          allNodes.set(parentId, {
            ...parent,
            childCount: parent.childCount + 1,
          });
        }
      }
      const rootNodeIds = computeRootNodeIds(allNodes);
      const expandedNodeIds = new Set(get().expandedNodeIds);
      if (parentId) {
        expandedNodeIds.add(parentId);
      }
      set({ allNodes, rootNodeIds, expandedNodeIds });
      const { nodes, edges } = buildFlowData(
        allNodes,
        expandedNodeIds,
        get().selectedNodeId,
      );
      set({ flowNodes: nodes, flowEdges: edges });
      return newNode;
    } catch (e) {
      set({ error: toMessage(e) });
      return null;
    }
  },

  renameNode: async (nodeId, title) => {
    try {
      await tauri.renameTreeNode(nodeId, title);
      const allNodes = new Map(get().allNodes);
      const node = allNodes.get(nodeId);
      if (node) {
        allNodes.set(nodeId, { ...node, title });
      }
      set({ allNodes });
      const { nodes, edges } = buildFlowData(
        allNodes,
        get().expandedNodeIds,
        get().selectedNodeId,
      );
      set({ flowNodes: nodes, flowEdges: edges });
    } catch (e) {
      set({ error: toMessage(e) });
    }
  },

  setNodeRole: async (nodeId, roleId) => {
    try {
      await tauri.setTreeNodeRole(nodeId, roleId);
      const allNodes = new Map(get().allNodes);
      const node = allNodes.get(nodeId);
      if (node) {
        allNodes.set(nodeId, { ...node, roleId });
      }
      set({ allNodes });
      const { nodes, edges } = buildFlowData(
        allNodes,
        get().expandedNodeIds,
        get().selectedNodeId,
      );
      set({ flowNodes: nodes, flowEdges: edges });
    } catch (e) {
      set({ error: toMessage(e) });
    }
  },

  moveNode: async (nodeId, newParentId, newOrder) => {
    try {
      await tauri.moveTreeNode(nodeId, newParentId, newOrder);
      await get().loadAllNodes();
    } catch (e) {
      set({ error: toMessage(e) });
    }
  },

  // ===== 视图切换 =====

  rebuildForCurrentChat: () => {
    const curId = currentChatIdNow();
    // 选中当前对话节点（可能是子节点）
    set({ selectedNodeId: curId });
    // 展开从根到当前节点的路径上的所有祖先，确保子节点可见
    if (curId) {
      const expanded = new Set(get().expandedNodeIds);
      let cur: Id | null = curId;
      let guard = 0;
      while (cur !== null && guard < 1000) {
        guard++;
        expanded.add(cur);
        const n = get().allNodes.get(cur);
        cur = n?.parentId ?? null;
      }
      set({ expandedNodeIds: expanded });
    }
    const { nodes, edges } = buildFlowData(
      get().allNodes,
      get().expandedNodeIds,
      curId,
    );
    set({ flowNodes: nodes, flowEdges: edges });
  },

  viewChatForNode: async (nodeId) => {
    get().setSelectedNode(nodeId);
    useAppStore.getState().selectChat(nodeId);
    useAppStore.getState().setTreeViewMode("chat");
    await useChatStore.getState().selectChat(nodeId);
  },

  // ===== Utility =====

  clearError: () => set({ error: null }),
}));
