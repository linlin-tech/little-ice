/**
 * AppShell（§9.1）
 *
 * 两栏布局：
 * - 左侧：LeftPanel（截图中的单栏导航+列表，替代原 Sidebar + ListPanel）
 * - 右侧：ContentPanel（原有对话/收藏/角色/设置详情，保持不变）
 */

import { LeftPanel } from "./LeftPanel";
import { ContentPanel } from "./ContentPanel";

export function AppShell(): React.JSX.Element {
  return (
    <div className="grid h-full grid-rows-1 overflow-hidden" style={{ gridTemplateColumns: "480px 1fr" }}>
      <LeftPanel />
      <ContentPanel />
    </div>
  );
}
