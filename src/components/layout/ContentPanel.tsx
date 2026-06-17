/**
 * ContentPanel（§9.4）
 *
 * 自适应宽度（flex-1 撑满剩余空间），背景 `bg-background`，内边距 `p-6`（24px）。
 *
 * 内容最大宽度 720px（`max-w-content`），保证阅读体验；超长自动居中。
 *
 * 根据 `appStore.view` 渲染对应内容：
 * - `chat`     → ChatContent
 * - `favorite` → FavoriteDetail
 * - `role`     → RoleDetail
 * - `settings` → SettingsPage（§22）
 */

import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/utils";

import { ChatContent } from "@/features/chat/components/ChatContent";
import { FavoriteDetail } from "@/features/favorite/components/FavoriteDetail";
import { RoleDetail } from "@/features/role/components/RoleDetail";
import { SettingsPage } from "@/features/settings/components/SettingsPage";

export function ContentPanel(): React.JSX.Element {
  const view = useAppStore((s) => s.view);

  return (
    <section className={cn("h-full bg-background")}>
      {view === "chat" && <ChatContent />}
      {view === "favorite" && <FavoriteDetail />}
      {view === "role" && <RoleDetail />}
      {view === "settings" && <SettingsPage />}
    </section>
  );
}
