/**
 * TreeFlowView（思维树图主视图，§4）
 *
 * 基于 @xyflow/react 渲染树状思维图：
 * - dagre 布局（TB 自上而下）
 * - 自定义节点组件（CustomTreeNode）
 * - 只读浏览模式：禁用拖拽/连线/缩放/平移
 * - 视图切换同步：切到树图时自动定位当前对话节点
 * - 集成删除确认对话框
 */

import { useCallback, useEffect } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useChatStore } from "@/features/chat/store";
import { useTreeViewStore } from "../store";
import { useTreeLayout } from "../hooks/useTreeLayout";
import { CustomTreeNode } from "./CustomTreeNode";
import { DeleteNodeDialog } from "./DeleteNodeDialog";
import { TreeEmptyState } from "./TreeEmptyState";
import { TreeErrorState } from "./TreeErrorState";
import { TreeLoadingSkeleton } from "./TreeLoadingSkeleton";

const nodeTypes: NodeTypes = { treeNode: CustomTreeNode };

function TreeFlowInner(): React.JSX.Element {
  const flowNodes = useTreeViewStore((s) => s.flowNodes);
  const flowEdges = useTreeViewStore((s) => s.flowEdges);
  const status = useTreeViewStore((s) => s.status);
  const error = useTreeViewStore((s) => s.error);
  const deleteDialog = useTreeViewStore((s) => s.deleteDialog);
  const deleting = useTreeViewStore((s) => s.deleting);
  const loadAllNodes = useTreeViewStore((s) => s.loadAllNodes);
  const setSelectedNode = useTreeViewStore((s) => s.setSelectedNode);
  const setDeleteDialog = useTreeViewStore((s) => s.setDeleteDialog);
  const confirmDelete = useTreeViewStore((s) => s.confirmDelete);
  const createNode = useTreeViewStore((s) => s.createNode);
  const rootNodeIds = useTreeViewStore((s) => s.rootNodeIds);

  const currentChatId = useChatStore((s) => s.currentChatId);
  const reactFlow = useReactFlow();

  // 首次挂载：加载所有节点
  useEffect(() => {
    if (status === "empty") {
      void loadAllNodes();
    }
  }, [status, loadAllNodes]);

  const rebuildForCurrentChat = useTreeViewStore((s) => s.rebuildForCurrentChat);

  // 切换对话时，重建树图（只显示当前对话这棵树）并定位居中
  useEffect(() => {
    if (status === "ready") {
      rebuildForCurrentChat();
      if (currentChatId) {
        const timer = setTimeout(() => {
          reactFlow.fitView({ padding: 0.3, maxZoom: 2, duration: 300, nodes: [{ id: currentChatId }] });
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [currentChatId, status, rebuildForCurrentChat, reactFlow]);

  // 应用 dagre 布局
  const { nodes: layoutedNodes, edges: layoutedEdges } = useTreeLayout(
    flowNodes,
    flowEdges,
    "TB",
  );

  // 连接线样式
  const styledEdges = layoutedEdges.map((e) => ({
    ...e,
    style: { stroke: "#D1D5DB", strokeWidth: 1.5 },
  }));

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode],
  );

  const handleCreateRoot = useCallback(async () => {
    const title = window.prompt("请输入话题名称：");
    if (title && title.trim()) {
      const node = await createNode(title.trim(), null);
      if (node) {
        setTimeout(() => reactFlow.fitView({ padding: 0.3, maxZoom: 2, duration: 300 }), 100);
      }
    }
  }, [createNode, reactFlow]);

  // 加载中
  if (status === "loading" && rootNodeIds.length === 0) {
    return <TreeLoadingSkeleton />;
  }

  // 加载失败
  if (status === "error" && rootNodeIds.length === 0) {
    return <TreeErrorState error={error ?? "未知错误"} onRetry={() => void loadAllNodes()} />;
  }

  // 无选中对话：提示选择对话
  if (status === "ready" && !currentChatId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm">请选择一个对话查看其思维导图</p>
      </div>
    );
  }

  // 空状态（无任何节点）
  if (status === "ready" && rootNodeIds.length === 0) {
    return <TreeEmptyState onCreateRoot={() => void handleCreateRoot()} />;
  }

  return (
    <>
      <div className="h-full w-full bg-sidebar">
        <ReactFlow
          nodes={layoutedNodes}
          edges={styledEdges}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          zoomOnScroll={false}
          panOnDrag={false}
          preventScrolling
          minZoom={1.5}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          attributionPosition="bottom-left"
        >
          <Background color="#e2e8f0" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/* 删除确认对话框 */}
      {deleteDialog && (
        <DeleteNodeDialog
          open={!!deleteDialog}
          onOpenChange={(open) => {
            if (!open) setDeleteDialog(null);
          }}
          nodeTitle={deleteDialog.nodeTitle}
          childCount={deleteDialog.childCount}
          isRoot={deleteDialog.isRoot}
          onConfirm={() => void confirmDelete()}
          loading={deleting}
        />
      )}
    </>
  );
}

export function TreeFlowView(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <TreeFlowInner />
    </ReactFlowProvider>
  );
}
