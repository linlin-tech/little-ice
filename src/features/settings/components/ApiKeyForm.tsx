/**
 * ApiKeyForm（§22.2）
 *
 * - 受控 input：debounce 500ms 实时保存（无 Save 按钮）
 * - 状态徽章：
 *   - 未配置：红色文字 "未配置 API Key"
 *   - 已配置：绿色文字 "✓ 已配置"
 * - 保存反馈（输入框下方）：
 *   - 成功："已保存 · 14:23"（`--success`）
 *   - 失败："保存失败，请重试"（`--error`）
 *
 * ## 状态机
 * - typing：用户正在输入（不写）
 * - saving：debounce 触发后，写入中
 * - saved：上次写入成功
 * - error：上次写入失败
 */

import { useEffect, useRef, useState } from "react";

import { useSettingsStore } from "@/features/settings/store";
import { formatClockTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

import { InlineMessage } from "@/components/common/InlineMessage";

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

const DEBOUNCE_MS = 500;

export function ApiKeyForm(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const load = useSettingsStore((s) => s.load);
  const saveApiKey = useSettingsStore((s) => s.saveApiKey);
  const storeError = useSettingsStore((s) => s.error);
  const clearError = useSettingsStore((s) => s.clearError);

  // input 本地值（受控）
  const [value, setValue] = useState(settings.deepseekApiKey);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  // 首次挂载 + settings 变化时同步（外部 reset 也能跟上）
  useEffect(() => {
    setValue(settings.deepseekApiKey);
  }, [settings.deepseekApiKey]);

  // 首次挂载：拉一次
  useEffect(() => {
    void load();
  }, [load]);

  // debounce timer 引用
  const timerRef = useRef<number | null>(null);
  // 标记 unmount，防止 debounce 在 unmount 后调 save
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // store 错误同步到 status
  useEffect(() => {
    if (storeError !== null) {
      setStatus({ kind: "error", message: "保存失败，请重试" });
    }
  }, [storeError]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setValue(next);
    setStatus({ kind: "idle" });
    clearError();

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      void doSave(next);
    }, DEBOUNCE_MS);
  };

  const doSave = async (v: string) => {
    // 与 store 里的现值一致 → 不发请求、不弹“已保存”。
    // 修复：API Key 为空时点输入框再离开会被当作“保存空串”处理。
    if (v === settings.deepseekApiKey) {
      setStatus({ kind: "idle" });
      return;
    }
    setStatus({ kind: "saving" });
    try {
      await saveApiKey(v);
      if (!mountedRef.current) return;
      setStatus({ kind: "saved", at: Date.now() });
    } catch {
      if (!mountedRef.current) return;
      setStatus({ kind: "error", message: "保存失败，请重试" });
    }
  };

  const onBlur = () => {
    // 立即 flush（不等 debounce）
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (status.kind !== "saving") {
      void doSave(value);
    }
  };

  const configured = settings.hasApiKey;

  return (
    <div className="space-y-3">
      {/* 标题 + 状态徽章 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">AI 模型</h3>
        {configured ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            ✓ 已配置
          </span>
        ) : (
          <span className="text-xs font-medium text-error">未配置 API Key</span>
        )}
      </div>
      <p className="text-xs text-muted">使用 DeepSeek 作为对话模型</p>

      <input
        type="password"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="sk-..."
        autoComplete="off"
        spellCheck={false}
        // §22.2 input：max-w 480 / padding / border / radius / monospace + letter-spacing
        className={cn(
          "block w-full max-w-[480px] rounded-md border border-border bg-background",
          "px-3.5 py-2.5 font-mono text-sm tracking-wider text-foreground outline-none",
          "focus:border-primary focus:ring-2 focus:ring-primary/15",
        )}
      />

      {/* 反馈行 */}
      {status.kind === "saving" && (
        <InlineMessage kind="info" text="保存中…" />
      )}
      {status.kind === "saved" && (
        <InlineMessage kind="success" text={`已保存 · ${formatClockTime(status.at)}`} />
      )}
      {status.kind === "error" && (
        <InlineMessage kind="error" text={status.message} />
      )}
    </div>
  );
}
