/**
 * App 入口
 *
 * ## 启动流程（§7.5）
 * 1. 调 `useSettingsStore.load()` 加载设置
 * 2. 等待 `status === 'ready'`
 * 3. 若 `!settings.hasApiKey` → `appStore.setView('settings')`（引导用户配 API Key）
 * 4. 否则维持默认（`view === 'chat'`）
 *
 * ## 全局包裹
 * - `<FeedbackToastProvider>`：4 种成功 + 4 种错误 toast
 * - `<CreateFavoriteProvider>`：AI 消息 ⭐ 按钮的 Dialog
 */
import { useEffect } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { CreateFavoriteProvider } from "@/features/favorite/components/CreateFavoriteDialog";
import { FeedbackToastProvider } from "@/components/common/FeedbackToast";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useSettingsStore } from "@/features/settings/store";
import { useRoleStore } from "@/features/role/store";
import { useAppStore } from "@/stores/appStore";

function App(): React.JSX.Element {
  const status = useSettingsStore((s) => s.status);
  const hasApiKey = useSettingsStore((s) => s.settings.hasApiKey);
  const load = useSettingsStore((s) => s.load);
  const setView = useAppStore((s) => s.setView);

  // Role 数据：Chat 列表的二级菜单「模型角色」需要 roles 数据，
  // 不能等到用户进 Model Role 模块才加载；启动时一次性拉好。
  const roleStatus = useRoleStore((s) => s.status);
  const loadRoles = useRoleStore((s) => s.loadRoles);

  // 启动：拉 settings
  useEffect(() => {
    if (status === "empty") {
      void load();
    }
  }, [status, load]);

  // 启动：拉 roles（让 Chat 列表的二级菜单在打开时已有可用角色，
  // 避免显示「无可用角色」。系统永远至少有「默认助手」这个内置角色）
  useEffect(() => {
    if (roleStatus === "empty") {
      void loadRoles();
    }
  }, [roleStatus, loadRoles]);

  // §7.5 启动引导：未配 API Key → 跳 settings
  useEffect(() => {
    if (status === "ready" && !hasApiKey) {
      setView("settings");
    }
  }, [status, hasApiKey, setView]);

  return (
    <FeedbackToastProvider>
      <CreateFavoriteProvider>
        <AppShell />
        <ConfirmDialog />
      </CreateFavoriteProvider>
    </FeedbackToastProvider>
  );
}

export default App;
