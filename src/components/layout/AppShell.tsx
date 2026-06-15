/**
 * AppShell（§9.1）
 *
 * 三栏 grid：Sidebar / List / Content。
 * - Sidebar 宽度随 `sidebarCollapsed` 变化（240px 展开 ↔ 60px 折叠）
 * - List Panel 固定 `w-80` (320px)，背景 `bg-background`
 * - Content Panel `flex-1` 撑满剩余空间，背景 `bg-background`
 *
 * 满高（`h-full`），无外边距。
 *
 * 关键不变量（设计系统 §9）：
 * - Sidebar 固定宽度，背景 `bg-sidebar`
 * - List Panel 固定 `w-80` (320px)，背景 `bg-background`
 * - Content Panel `flex-1` 撑满剩余空间，背景 `bg-background`，内边距 `p-6`
 *
 * 三栏的内容分别由 `<Sidebar />` / `<ListPanel />` / `<ContentPanel />` 提供。
 */

import { useAppStore } from "@/stores/appStore";

import { ContentPanel } from "./ContentPanel";
import { ListPanel } from "./ListPanel";
import { Sidebar } from "./Sidebar";

export function AppShell(): React.JSX.Element {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);

  return (
    <div
      className="grid h-full grid-rows-1 overflow-hidden transition-[grid-template-columns] duration-200 ease-out"
      style={{
        gridTemplateColumns: sidebarCollapsed
          ? "60px 320px 1fr"
          : "240px 320px 1fr",
      }}
    >
      <Sidebar />
      <ListPanel />
      <ContentPanel />
    </div>
  );
}
