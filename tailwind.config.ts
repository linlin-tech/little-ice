/// <reference types="vite/client" />
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

/**
 * Tailwind v3 配置
 *
 * 设计 token 通过 CSS 变量（`globals.css`）注入；本文件只做 alias 与扩展。
 * 颜色、圆角、字体、最大宽度全部走 CSS 变量，便于后续主题切换。
 *
 * 参考：docs/design-system.md §23.1
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: "hsl(var(--primary))",
          soft: "hsl(var(--primary-soft))",
          strong: "hsl(var(--primary-strong))",
          tint: "hsl(var(--primary-tint))",
          hover: "hsl(var(--primary-hover))",
          foreground: "hsl(var(--primary-foreground))",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        sidebar: "hsl(var(--sidebar))",
        "user-bubble": "hsl(var(--user-bubble))",
        border: "hsl(var(--border))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted))",
        },
        success: "hsl(var(--success))",
        error: "hsl(var(--error))",
        warning: "hsl(var(--warning))",
        // shadcn/ui 兼容（DoNot 删，shadcn 组件依赖）
        ring: "hsl(var(--primary))",
        input: "hsl(var(--border))",
        card: {
          DEFAULT: "hsl(var(--background))",
          foreground: "hsl(var(--foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--background))",
          foreground: "hsl(var(--foreground))",
        },
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "12px",
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Microsoft YaHei"', "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "Consolas", "monospace"],
      },
      maxWidth: {
        content: "720px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
