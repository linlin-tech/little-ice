/**
 * useTreeLayout（dagre 布局算法，§4.2）
 *
 * 用 dagre 计算 XYFlow 节点的位置坐标。
 * 配置：rankdir=TB, align=UL, nodesep=20, ranksep=40, marginx/y=40。
 * 节点尺寸：120×36px（与 CustomTreeNode 保持一致）。
 */

import { useMemo } from "react";
import dagre from "dagre";
import type { Edge } from "@xyflow/react";

import type { TreeNodeFlowNode } from "../types/xyflow";

const NODE_WIDTH = 120;
const NODE_HEIGHT = 36;
const RANK_SEP = 40;
const NODE_SEP = 0;

export function useTreeLayout(
  nodes: TreeNodeFlowNode[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB",
): { nodes: TreeNodeFlowNode[]; edges: Edge[] } {
  return useMemo(() => {
    if (nodes.length === 0) {
      return { nodes, edges };
    }

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
      rankdir: direction,
      align: "UL",
      ranksep: RANK_SEP,
      nodesep: NODE_SEP,
      marginx: 40,
      marginy: 40,
    });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
      const dagreNode = dagreGraph.node(node.id);
      if (!dagreNode) return node;
      return {
        ...node,
        position: {
          x: dagreNode.x - NODE_WIDTH / 2,
          y: dagreNode.y - NODE_HEIGHT / 2,
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  }, [nodes, edges, direction]);
}
