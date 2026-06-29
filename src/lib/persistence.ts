/**
 * persistence（§6.5 持久化抽象）
 *
 * 包装 `@tauri-apps/plugin-store`，提供单例式的「UI 偏好」KV 存储。
 *
 * ## 用法
 * ```ts
 * const store = await getUiPrefs();
 * await store.get<MyType>("my-key");
 * await store.set("my-key", value);
 * await store.save();
 * ```
 *
 * ## 设计要点
 * - 文件名固定为 `ui-prefs.json`（与 settings（API Key）位于数据库中区分）
 * - 单例：模块级缓存 `Store` 实例，避免重复打开文件
 * - `autoSave: false` 关闭自动保存：调用方按需 `save()`，避免每次 set 都落盘
 *   （典型用法是状态变化时 set 一批字段，最后 save 一次）
 * - `defaults: {}` 占位：本文件不规定默认值；具体 key 的默认值由调用方决定
 *
 * ## 与后端 settings 的边界
 * - 后端 `get_settings / set_api_key`：业务数据（API Key），走 SQLite
 * - 本文件：UI 偏好（分组展开/收缩、侧栏宽度等），走 plugin-store
 */

import { load, type Store } from "@tauri-apps/plugin-store";

const STORE_FILE = "ui-prefs.json";

let storePromise: Promise<Store> | null = null;

/**
 * 懒加载获取 UI 偏好 store。
 * 多次调用复用同一份 Promise（模块内单例），不会出现竞态。
 */
export function getUiPrefs(): Promise<Store> {
  if (storePromise === null) {
    storePromise = load(STORE_FILE, { autoSave: false, defaults: {} });
  }
  return storePromise;
}
