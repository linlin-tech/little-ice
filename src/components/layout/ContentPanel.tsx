/**
 * ContentPanel（§9.4 + 思维树图设计文档 §2）
 *
 * chat 视图布局：
 * - 顶部：统一 ChatHeader（对话/树图共用，含切换按钮）
 * - 下方：根据 treeViewMode 切换 ChatContent / TreeFlowView
 *
 * 其他视图（favorite/role/settings）保持原有行为。
 */

import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/utils";

import { ChatContent } from "@/features/chat/components/ChatContent";
import { ChatHeader } from "@/features/chat/components/ChatHeader";
import { FavoriteDetail } from "@/features/favorite/components/FavoriteDetail";
import { RoleDetail } from "@/features/role/components/RoleDetail";
import { SettingsPage } from "@/features/settings/components/SettingsPage";
import { TreeFlowView } from "@/features/tree/components/TreeFlowView";

export function ContentPanel(): React.JSX.Element {
  const view = useAppStore((s) => s.view);
  const treeViewMode = useAppStore((s) => s.treeViewMode);

  // 非 chat 视图：保持原有行为
  if (view !== "chat") {
    return (
      <section className={cn("h-full bg-background")}>
        {view === "favorite" && <FavoriteDetail />}
        {view === "role" && <RoleDetail />}
        {view === "settings" && <SettingsPage />}
      </section>
    );
  }

  // chat 视图：统一 Header + 内容区
  return (
    <section className={cn("flex h-full flex-col bg-background")}>
      <ChatHeader />
      <div className="min-h-0 flex-1 overflow-hidden">
        {treeViewMode === "chat" ? <ChatContent /> : <TreeFlowView />}
      </div>
    </section>
  );
}
