/**
 * SettingsPage（§22.1）
 *
 * 页面结构：
 * - Header "设置"（20px / 600）
 * - Sections：
 *   1. AI Model      → <ApiKeyForm />
 *   2. Appearance    → <AppearanceSection />
 *   3. Status & Feedback（演示区块，§17 + §18 + §19 全部反馈的入口）
 *
 * 集成位置：`ContentPanel`（当 `appStore.view === 'settings'` 时挂载）。
 */

import { ApiKeyForm } from "./ApiKeyForm";
import { AppearanceSection } from "./AppearanceSection";

export function SettingsPage(): React.JSX.Element {
  return (
    <div className="h-full overflow-y-auto bg-background p-6">
      <div className="mx-auto max-w-content space-y-8">
        {/* Header（§22.1：20px / 600） */}
        <h1 className="text-xl font-semibold text-foreground">设置</h1>

        {/* Sections */}
        <section>
          <ApiKeyForm />
        </section>

        <section>
          <AppearanceSection />
        </section>
      </div>
    </div>
  );
}
