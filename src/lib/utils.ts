/**
 * 通用工具
 *
 * - `cn(...)`：Tailwind class 合并（处理条件 class + dedupe 冲突）
 * - `formatRelativeTime(ts)`：相对时间（"3 分钟前"）
 * - `formatClockTime(ts)`：时钟时间（"14:23"）
 * - `truncate(s, n)`：按字符数截断（中文友好）
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind class 合并（shadcn 模式） */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// =============================================================
// 时间格式化
// =============================================================

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 相对时间（与设计系统 §3 `createdAt` 一致，Unix ms） */
export function formatRelativeTime(ts: number, now: number = Date.now()): string {
  const diff = now - ts;
  if (diff < MINUTE) return "刚刚";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  // 超过 7 天：显示 `YYYY-MM-DD`
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 时钟 `HH:MM`（与设计系统 §3.1 列表项时间一致） */
export function formatClockTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// =============================================================
// 字符串工具
// =============================================================

/** 字符数截断（中文友好，按 `Array.from(s).length` 计） */
export function truncate(s: string, n: number): string {
  const chars = Array.from(s);
  if (chars.length <= n) return s;
  return chars.slice(0, Math.max(0, n - 1)).join("") + "…";
}
