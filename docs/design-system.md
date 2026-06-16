# Little Ice Design System

---

# 1. Document Information

| Item     | Value                       |
| -------- | --------------------------- |
| Project  | Little Ice                  |
| Type     | Design System               |
| Status   | MVP Baseline                |
| Platform | Desktop (Tauri 2.x)         |
| Frontend | React + TS + shadcn/ui + Tailwind |
| Language | Simplified Chinese          |
| Theme    | Light Only                  |
| 配套文档    | ux-specification.md / frontend-architecture.md |

---

# 2. Design Philosophy

## Product Keywords

```text
轻量
干净
安静
专注
阅读友好
知识沉淀
```

## Avoid

```text
赛博朋克
游戏风
炫酷特效
大阴影
复杂渐变
管理后台风格
```

## Design Goal

Little Ice 应该像：

```text
Apple Notes
+
Bear
+
微信读书
+
Claude
```

而不是：

```text
Cursor
VSCode
Jira
管理后台
```

---

# 3. Theme

## MVP Theme Strategy

```yaml
Theme:
  Light Only

Dark Theme:
  Future Version
```

不引入主题切换框架，不使用 `next-themes` 之类的运行时切换。MVP 阶段所有颜色硬编码 Light 值。

---

# 4. Color System

## 4.1 主色系（Primary / 蓝色调）

| Token | Hex | 用途 |
|---|---|---|
| `--primary` | `#7CC7FF` | Logo、Focus 边框、强调元素、品牌色 |
| `--primary-soft` | `#EEF7FF` | 选中背景、Primary Soft Button 底色 |
| `--primary-strong` | `#2563EB` | 激活态文字、Primary Button 文字、强调链接 |
| `--primary-tint` | `#E3F3FF` | Primary Soft Button hover |
| `--primary-hover` | `#F5F9FF` | 白色背景上的轻量 hover |

**色阶关系**：

```text
#2563EB (strong)  ← 文字、激活
   ↓
#7CC7FF (primary) ← Logo、Focus
   ↓
#E3F3FF (tint)    ← Button hover
   ↓
#EEF7FF (soft)    ← 选中背景
   ↓
#F5F9FF (hover)   ← 普通 hover
```

## 4.2 中性色（Neutral / 灰阶）

| Token | Hex | 用途 |
|---|---|---|
| `--bg` | `#FFFFFF` | 应用主背景、内容区、Dialog 背景 |
| `--bg-sidebar` | `#F8F9FB` | Sidebar 背景 |
| `--bg-user-bubble` | `#F7F8FA` | 用户消息气泡底色 |
| `--border` | `#EAECEF` | 分割线、Input 边框、Panel 边框 |
| `--text-primary` | `#1F2328` | 主要文字 |
| `--text-secondary` | `#6B7280` | 次要文字、时间戳、Placeholder |

## 4.3 反馈色（Feedback）

MVP 不引入完整 status 调色板，仅保留：

| Token | Hex | 用途 |
|---|---|---|
| `--success` | `#16A34A` | "已保存"、"已收藏"、"已删除" 微提示 |
| `--error` | `#DC2626` | API Key 错误、网络错误、模型错误、校验错误 |
| `--warning` | `#D97706` | 停止生成、可恢复警告 |

**使用原则**：反馈色只用于**文字 / 图标 / 极细边框**，不用于大块背景。

---

# 5. Typography

## 5.1 字体

```css
font-family:
  "Noto Sans SC",
  "Microsoft YaHei",
  -apple-system,
  BlinkMacSystemFont,
  sans-serif;
```

AI 回复内的**代码块**使用等宽字体：

```css
font-family:
  "JetBrains Mono",
  "Fira Code",
  Consolas,
  monospace;
```

## 5.2 字号 & 字重

| Token | Size | Weight | 用途 |
|---|---|---|---|
| `--text-brand` | 16px | 600 | Logo "小冰" |
| `--text-nav` | 14px | 400 | 侧边栏导航 |
| `--text-list-title` | 14px | 500 | Chat/Favorite 列表项标题 |
| `--text-list-meta` | 12px | 400 | 列表项时间戳 |
| `--text-message` | 15px | 400 | 消息正文（行高 1.9） |
| `--text-secondary` | 12px | 400 | 时间戳、占位提示 |
| `--text-code` | 13px | 400 | 代码块 |
| `--text-button` | 14px | 500 | 按钮文字 |

## 5.3 行高

| 场景 | line-height |
|---|---|
| 消息正文 | 1.9（阅读友好） |
| 列表项 | 1.4 |
| 导航 | 1.5 |
| 按钮 | 1 |

---

# 6. Spacing

基于 4px 网格：

```text
4   8   12  16  20  24  32  40  48
```

| 场景 | 值 |
|---|---|
| 列表项内边距 | 12px（上下 12，左右 16） |
| 消息内边距（用户气泡） | 10px 14px |
| 导航项垂直内边距 | 10px |
| 内容区与边缘 | 24px |
| 元素间小间距 | 8px |
| 模块间大间距 | 24px |

---

# 7. Radius

| Token | 值 | 用途 |
|---|---|---|
| `--radius-sm` | 6px | Tag、小型 chip |
| `--radius` | **8px** | Button、Input、List Item（**标准**） |
| `--radius-md` | 10px | 小型 Card |
| `--radius-lg` | 12px | Dialog（统一为 12px，V1.0 的 10px 弃用） |

**MVP 全局默认 8px**，Dialog 12px。

---

# 8. Shadow

MVP 几乎不用阴影，只允许以下两种：

```css
/* 默认：无 */
box-shadow: none;

/* 极少数需要浮起时 */
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
```

**禁止**：大阴影、彩色阴影、长投影、多层阴影。

---

# 9. Layout

## 9.1 主窗口三栏

```text
┌──────────┬────────────────┬────────────────────┐
│ Sidebar  │ List Panel     │ Content Panel      │
│  240px   │    320px       │   自适应宽度         │
└──────────┴────────────────┴────────────────────┘
```

> V1.0 写的 220 / 260 弃用，**改为 240 / 320**，与 UX §7 / 架构 §7.1 一致。

## 9.2 Sidebar

```text
宽度：240px（可隐藏/展开）
背景：--bg-sidebar

结构（自上而下）：
  Logo
  ─────────
  对话
  收藏
  设置
  ─────────
  (Flexible Space)
```

**隐藏/展开行为**：
- 通过 `appStore.sidebarCollapsed` 状态控制
- 隐藏时：Sidebar 宽度收缩为 0，仅显示一个展开按钮（固定在左侧边缘）
- 展开时：恢复 240px 宽度
- 过渡动画：200ms ease-out

## 9.3 List Panel

```text
宽度：320px
背景：--bg
顶部 Toolbar（Chat 模块：图标+标题+数量+New Chat 按钮；Favorite 模块：图标+标题+数量）

列表项宽度：撑满 List Panel
```

## 9.4 Content Panel

```text
宽度：剩余空间
背景：--bg
内边距：24px

内容最大宽度：720px（消息和正文居中显示，保证阅读体验）
```

---

# 10. Navigation（Sidebar）

## 10.1 项结构

```text
[Icon]  文字
```

**Icon 在左，文字在右**。使用 lucide-react 组件：

| 菜单 | Icon |
|---|---|
| 对话 | `<MessageSquare />` |
| 收藏 | `<Star />` |
| 设置 | `<Settings />` |

## 10.2 状态

**默认**：

```css
background: transparent;
color: --text-primary;
```

**Hover**：

```css
background: --primary-hover;   /* #F5F9FF */
color: --text-primary;
```

**Active（当前页面）**：

```css
background: --primary-soft;    /* #EEF7FF */
color: --primary-strong;       /* #2563EB */
```

> 激活文字色 #2563EB 重命名为 `--primary-strong`，与主色系呼应。

---

# 11. Logo

## 11.1 位置

```text
Sidebar 顶部
```

## 11.2 排版

```text
小冰 ✦
```

- 字号：`--text-brand`（16px / 600）
- "小冰" 颜色： `--text-primary`（#1F2328）
- "✦" 颜色： `--primary`（#7CC7FF）

---

# 12. Button

## 12.1 Primary Button（实心强调）

**用途**：Send（发送消息）、Save（手动保存 Favorite）

```css
background: --primary-strong;   /* #2563EB */
color: #FFFFFF;
border: none;
border-radius: --radius;        /* 8px */
padding: 8px 16px;
font: --text-button;
```

**Hover**：

```css
background: #1D4FD8;            /* primary-strong 深一档 */
```

**Disabled**：

```css
background: --border;           /* #EAECEF */
color: --text-secondary;
cursor: not-allowed;
```

## 12.2 Soft Button（柔色强调）

**用途**：New Chat、Confirm（确认弹窗确认按钮）

```css
background: --primary-soft;     /* #EEF7FF */
color: --primary-strong;        /* #2563EB */
border: none;
border-radius: --radius;
padding: 8px 16px;
```

**Hover**：

```css
background: --primary-tint;     /* #E3F3FF */
```

## 12.3 Ghost Button（无底色）

**用途**：Stop Generation、Cancel

```css
background: transparent;
color: --text-secondary;
border: none;
```

**Hover**：

```css
background: --primary-hover;
color: --text-primary;
```

## 12.4 Destructive Button（危险操作）

**用途**（V1.2 更新）：仅在**确认 Dialog 内部**使用（删除 Chat、Favorite 后的二次确认）。**列表项 hover 区**使用纯 IconButton 触发 Dialog，**详情页不再使用** Destructive Button。

```css
background: transparent;
color: --error;                 /* #DC2626 */
border: 1px solid --error;
border-radius: --radius;
```

**Hover**：

```css
background: #FEF2F2;            /* error 极浅底 */
```

## 12.5 图标按钮（通用）

**用途**：消息旁的收藏按钮、Header 上的更多按钮等

```css
size: 32×32px
border-radius: --radius
background: transparent
color: --text-secondary
hover: background --primary-hover, color --text-primary
```

## 12.6 列表项 IconButton（V1.2 新增）

**用途**：Chat 列表、Favorite 列表 hover 时出现的 Edit / Delete 图标按钮

```css
size: 28×28px
border-radius: 6px
background: transparent
color: --text-secondary
```

**Edit 按钮 hover**：

```css
background: --primary-hover;
color: --primary-strong;        /* #2563EB */
```

**Delete 按钮 hover**：

```css
background: --primary-hover;
color: --error;                 /* #DC2626 */
```

---

# 13. List Item（Chat / Favorite 共用）

## 13.1 容器

```css
padding: 12px 16px;
border-radius: --radius;        /* 8px */
margin: 0 8px;                  /* 列表项之间留 8px 边距 */
background: transparent;
cursor: pointer;
```

## 13.2 内容布局

```text
┌─────────────────────────┐
│ Title (14/500)          │
│ Updated 3 分钟前 (12)   │
└─────────────────────────┘
```

- Title：单行省略号（`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`）
- Meta：`--text-list-meta`，`--text-secondary` 色

## 13.3 状态

**Default**：

```css
background: transparent;
```

**Hover**：

```css
background: --primary-hover;   /* #F5F9FF */
```

**Selected（当前激活）**：

```css
background: --primary-soft;    /* #EEF7FF */
border-left: 3px solid --primary;  /* #7CC7FF 左侧色条 */
```

> 注意：选中态与默认态保持相同的 `px-4` 内边距，border-left 在 padding 之外，避免切换时文字跳动。

**Hover 时显示操作图标**（V1.2 更新：现在显示**两个**图标）：

```text
┌─────────────────────────┐
│ Title            [✎] [🗑] │
│ Updated 3 分钟前         │
└─────────────────────────┘
```

- 列表项右侧淡入 **Edit + Delete** 两个 IconButton（透明度 0 → 1，150ms）
- Edit 行为：点击后 Title 进入行内编辑模式（`<input>` 替换文字），Enter / Blur 确认，Esc 取消
- Delete 行为：点击后触发确认 Dialog
- 样式见 §12.6

## 13.4 行内编辑态（V1.2 新增）

点击 Edit 图标后，Title 切换为 input：

```css
input {
  width: 100%;
  font: --text-list-title;      /* 14px / 500 */
  color: --text-primary;
  border: none;
  border-bottom: 1px solid --primary;  /* 蓝色下划线提示编辑中 */
  outline: none;
  background: transparent;
  padding: 0;
}
```

**Enter / Blur**：调 `renameChat` / `renameFavorite`，恢复正常态
**Esc**：放弃修改，恢复原值

---

# 14. Message & Chat Header

## 14.0 Chat Header 布局（V1.2 引入，V1.3 简化，V1.4 重新调整）

```text
┌────────────────────────────────────────────────┐
│ [话题名称]                          [⭐ N]    │
└────────────────────────────────────────────────┘
```

```css
padding: 16px 24px;
border-bottom: 1px solid --border;
display: flex;
align-items: center;
justify-content: space-between;
gap: 12px;
```

**左侧** Title：

```css
font: 15px / 600;
color: --text-primary;
cursor: pointer;               /* 暗示可点击重命名 */
flex: 1;
min-width: 0;
overflow: hidden;
text-overflow: ellipsis;
white-space: nowrap;
```

**右侧** Favorite Count Badge：

```text
┌──────────┐
│ ⭐ 3     │   /* lucide <Star /> fill + 数字 */
└──────────┘
```

```css
display: inline-flex;
align-items: center;
gap: 4px;
padding: 4px 10px;
border-radius: 12px;            /* 胶囊形 */
background: --primary-soft;     /* #EEF7FF */
color: --primary-strong;        /* #2563EB */
font: 12px / 500;

svg { width: 12px; height: 12px; }
```

**规则**：
- N = `chatStore.favoriteCount`
- N = 0 时：Star 图标空心（`fill="none"`），背景透明，文字灰色（`--muted`）
- N > 0 时：Star 图标实心（`fill="currentColor"`），背景 `--primary-soft`，文字 `--primary-strong`
- N > 99 时显示 `99+`
- 点击徽章：MVP 暂不响应（UX §8.2）

**V1.4 明确**：Header 右侧**只显示**徽章，**不显示**"收藏"图标按钮和"更多/三点"图标按钮。

## 14.1 用户消息

```text
位置：右对齐
最大宽度：70% Content Panel
气泡：圆角矩形
```

```css
background: --bg-user-bubble;   /* #F7F8FA */
color: --text-primary;
padding: 10px 14px;
border-radius: --radius;        /* 8px */
font: --text-message;
```

## 14.2 AI 消息

```text
位置：左对齐
无气泡（与阅读 App 一致）
容器宽度：100% Content Panel
正文最大宽度：720px
```

```css
background: transparent;
color: --text-primary;
font: --text-message;
line-height: 1.9;
```

**Markdown 渲染**（react-markdown + remark-gfm + rehype-highlight）：

| 元素 | 样式 |
|---|---|
| 段落 | 段落间距 12px |
| 一级标题 | 20px / 600，段前 24px |
| 二级标题 | 17px / 600，段前 20px |
| 三级标题 | 15px / 600，段前 16px |
| 行内代码 | 背景 `--primary-soft`，文字 `--primary-strong`，圆角 4px，padding 2px 6px |
| 代码块 | 背景 `--bg-sidebar`，圆角 8px，padding 16px，字体 `--text-code`，超出横向滚动 |
| 链接 | 颜色 `--primary-strong`，下划线 |
| 列表 | 段前 8px，缩进 24px |
| 引用 | 左边框 3px `--primary`，padding-left 12px，文字 `--text-secondary` |

## 14.3 System 消息（如停止生成提示）

```text
位置：居中
样式：纯文字，无背景
```

```css
color: --text-secondary;
font: --text-secondary;         /* 12px */
```

---

# 15. Input Area（Chat）

## 15.1 Chat Input 容器

```text
固定在 Content Panel 底部
宽度：与 Content Panel 一致（撑满）
内边距：16px 24px
背景：--bg
顶部 1px 边框：--border
```

## 15.2 Textarea

```css
width: 100%;
min-height: 56px;
max-height: 200px;
padding: 12px 14px;
border: 1px solid --border;
border-radius: --radius;        /* 8px */
background: --bg;
color: --text-primary;
font: --text-message;
resize: none;                   /* 禁止手动拖拽高度 */
outline: none;
```

**Focus**：

```css
border-color: --primary;        /* #7CC7FF */
box-shadow: 0 0 0 3px rgba(124, 199, 255, 0.15);  /* 极轻光晕 */
```

**Placeholder**：

```text
请输入内容…
color: --text-secondary
```

## 15.3 操作按钮

位于 textarea 右下角内嵌：

| AI 状态 | 按钮显示 |
|---|---|
| `idle` | Send（Primary） |
| `sending` / `generating` | Stop（Ghost，旋转图标） |
| `failed` | Send（Primary）+ 错误提示在按钮上方 Inline |
| `stopped` | Send（Primary） |

---

# 16. Dialog

## 16.1 MVP 用途

**只用于危险操作的二次确认**（UX §6）：

- 删除 Chat（由 ChatList hover Delete 触发）
- 删除 Favorite（由 FavoriteList hover Delete 触发）
- 取消收藏（由 MessageItem 收藏图标触发）
- 清空数据（未来）

**禁止**用 Dialog 承载 Settings、编辑、向导等内容。

> V1.2 更新：Favorite 详情页底部不再有 Delete 按钮，所有删除入口均从**列表项 hover** 触发。

## 16.2 规格

```css
width: 420px
padding: 24px
background: --bg
border-radius: --radius-lg       /* 12px，V1.0 的 10px 弃用 */
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08)   /* MVP 唯一允许的"较重"阴影，仅 Dialog */
```

## 16.3 内容结构

```text
标题（16px / 600）
─────────
正文描述（14px / 400，--text-secondary）
─────────
[取消]                    [确认删除]
   (Ghost)              (Destructive / Soft)
```

**按钮顺序**：取消在左，主操作在右。**主操作 = Destructive**（删除场景）。

## 16.4 实现

使用 shadcn/ui 风格的 Dialog（基于 @radix-ui/react-dialog）替代 Tauri Dialog Plugin：

```tsx
// ConfirmDialog.tsx — 全局单例，在 App 顶层挂载
export function ConfirmDialog(): React.JSX.Element | null { ... }

// confirmDestructive — 返回 Promise<boolean>
export async function confirmDestructive(message: string): Promise<boolean> { ... }
```

- 宽度 420px，圆角 12px，阴影
- 标题固定为"确认删除"，正文为传入的 message
- 按钮：取消（Ghost）/ 删除（Destructive）
- 已移除 `@tauri-apps/plugin-dialog` 依赖

---

# 17. Status & Feedback

> 对应 UX §13。

## 17.1 成功反馈

**3 种形式**（按场景选其一）：

### 形式 A：按钮状态变化

```text
场景：Save 按钮被点击后
行为：按钮文案 "Save" → "Saved"（颜色变为 --success），2s 后恢复
```

### 形式 B：列表项状态变化

```text
场景：消息被收藏
行为：消息旁的收藏 IconButton 由空心 Star 变为实心 Star（lucide-react 切换 fill）
```

### 形式 C：保存时间显示

```text
场景：Favorite 自动保存完成
行为：编辑器底部显示 "已保存 · 14:23"
```

## 17.2 错误反馈

**统一使用 Inline Message**（行内提示，紧贴触发处，**不弹窗**）：

```text
样式：
  背景：透明
  左边框：3px solid --error
  文字：--error
  字号：--text-secondary (12px)
  图标：lucide <AlertCircle />, 14px
```

**典型场景**：

| 错误类型 | 触发位置 | 文案 |
|---|---|---|
| API Key 错误 | Settings 页面 | "API Key 无效，请检查后重试" |
| 网络错误 | Input Area 上方 | "网络连接失败，请重试" |
| 模型错误 | 消息流末尾 | "模型返回异常，请重试或停止" |
| 校验错误 | Input 下方 | "请输入有效内容" |

**消失时机**：3 秒后自动消失，或用户开始新操作时立即消失。

---

# 18. Empty State

> 对应 UX §12 Chat/Favorite 的 `empty` 状态。

## 18.1 视觉

```text
居中显示（垂直水平）
图标：lucide <MessageSquare /> 或 <Star />, 48px, --text-secondary, opacity 0.5
主文案：14px / 500, --text-primary
副文案：12px / 400, --text-secondary
可选 CTA：Soft Button
```

## 18.2 各页面空态文案

| 页面 | 主文案 | 副文案 | CTA |
|---|---|---|---|
| Chat（无对话） | "开始你的第一次对话" | "在下方输入框输入内容，按 Enter 发送" | 无 |
| Chat（无消息） | "还没有消息" | "发送一条消息试试" | 无 |
| Favorite（无收藏） | "还没有收藏" | "在 AI 回复旁点击收藏图标，内容会出现在这里" | 无 |
| Settings（无 API Key） | "配置 API Key" | "填入 DeepSeek API Key 后即可开始对话" | 无（表单即 CTA） |

---

# 19. AI State Indicator

> 对应 UX §9 / §12 AI 状态机。

## 19.1 状态映射

| aiState | 按钮 | 按钮图标 | 按钮文案 | 消息区表现 |
|---|---|---|---|---|
| `idle` | Primary | `<Send />` | "发送" | 正常 |
| `sending` | Ghost | `<Square />`（旋转） | "停止" | 用户消息下方显示 "●" 跳动（3 个点，1s 循环） |
| `generating` | Ghost | `<Square />` | "停止" | AI 消息气泡内文字逐字追加；底部显示光标 `▍` |
| `completed` | Primary | `<Send />` | "发送" | 正常 |
| `failed` | Primary | `<Send />` | "重试" | AI 消息位置显示 Inline Error |
| `stopped` | Primary | `<Send />` | "发送" | 已生成内容保留，末尾显示 "已停止生成" |

## 19.2 跳动 Loading 点

```css
display: inline-flex;
gap: 3px;

.dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: --text-secondary;
  animation: bounce 1.2s infinite;
}

.dot:nth-child(2) { animation-delay: 0.15s; }
.dot:nth-child(3) { animation-delay: 0.3s; }
```

---

# 20. Auto-save Indicator（Favorite）

> 对应 UX §11。

## 20.1 状态

仅保留保存按钮，状态通过按钮样式表达：
- isDirty = false：按钮 disabled（灰色，不可点击）
- isDirty = true：按钮可用（Primary，可点击）
- isSaving = true：按钮显示旋转 spinner（不显示文字）

**位置**：FavoriteDetail 编辑器底部，右对齐。

**Save 按钮**：
- isDirty = false：disabled（`--border` 背景）
- isDirty = true：可用（Primary）
- 保存成功后直接恢复 disabled 状态，不显示中间态文字

---

# 21. Scrollbar

## 21.1 规格

```css
width: 6px;
background: transparent;

thumb {
  background: #D7DDE5;
  border-radius: 3px;
}

track {
  background: transparent;
}
```

## 21.2 行为

```text
默认：隐藏（页面仍可滚动，但不显示 scrollbar）
Hover / Active：显示 6px 细 scrollbar
```

通过 Tailwind 自定义或全局 CSS：

```css
.scroll-area::-webkit-scrollbar { width: 6px; }
.scroll-area::-webkit-scrollbar-thumb { background: #D7DDE5; border-radius: 3px; }
.scroll-area::-webkit-scrollbar-track { background: transparent; }
.scroll-area { scrollbar-width: thin; scrollbar-color: #D7DDE5 transparent; }
```

---

# 22. Settings Page（替代 V1.0 的 "Settings Dialog"）

> V1.0 把 Settings 放在 Dialog 里，**V1.1 修正**：Settings 是 Content Panel 中的一个 Page（UX §4 IA / 架构 §6.1）。

## 22.1 页面结构

```text
ContentPanel
└── SettingsPage
    ├── Header
    │   "设置" (20px / 600)
    │
    └── Sections
        ├── AI Model
        │   标题："AI Model"
        │   说明："使用 DeepSeek 作为对话模型"
        │   表单：API Key 输入
        │   状态：已配置 / 未配置
        │
        └── Appearance
            标题："Appearance"
            说明："当前主题：Light（MVP 暂不支持切换）"
```

## 22.2 API Key 输入

```css
input {
  width: 100%;
  max-width: 480px;
  padding: 12px 14px;
  border: 1px solid --border;
  border-radius: --radius;
  background: --bg;
  color: --text-primary;
  font: --text-message;
}
```

**Focus**：

```css
border-color: --primary;
box-shadow: 0 0 0 3px rgba(124, 199, 255, 0.15);
```

**状态标签**：

```text
已配置：--success（绿色）
未配置：--error（红色）
```

---

# 23. Markdown 渲染样式

## 23.1 全局样式类

Markdown 渲染统一使用 `.markdown-body` 类名，在 `globals.css` 中定义：

```css
.markdown-body {
  font-size: 15px;
  line-height: 1.9;
  color: hsl(var(--foreground));
}

.markdown-body p { margin-top: 0.75em; margin-bottom: 0.75em; }
.markdown-body h1 { font-size: 20px; font-weight: 600; margin-top: 1.5em; margin-bottom: 0.5em; padding-bottom: 0.3em; border-bottom: 1px solid hsl(var(--border)); }
.markdown-body h2 { font-size: 17px; font-weight: 600; margin-top: 1.25em; margin-bottom: 0.5em; padding-bottom: 0.2em; border-bottom: 1px solid hsl(var(--border)); }
.markdown-body h3 { font-size: 15px; font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; }
.markdown-body ul, .markdown-body ol { margin-top: 0.5em; margin-bottom: 0.5em; padding-left: 1.5em; }
.markdown-body ul { list-style-type: disc; }
.markdown-body ol { list-style-type: decimal; }
.markdown-body li { margin-top: 0.25em; margin-bottom: 0.25em; }
.markdown-body blockquote { margin: 1em 0; padding: 0.5em 1em; border-left: 3px solid hsl(var(--primary)); background-color: hsl(var(--sidebar)); border-radius: 0 8px 8px 0; color: hsl(var(--muted)); }
.markdown-body code { font-family: "JetBrains Mono", "Fira Code", Consolas, monospace; font-size: 0.85em; background-color: hsl(var(--primary-soft)); color: hsl(var(--primary-strong)); padding: 0.15em 0.4em; border-radius: 4px; }
.markdown-body pre { margin: 1em 0; padding: 1em; background-color: hsl(var(--sidebar)); border-radius: 8px; overflow-x: auto; }
.markdown-body pre code { background-color: transparent; color: inherit; padding: 0; font-size: 13px; line-height: 1.6; }
.markdown-body a { color: hsl(var(--primary-strong)); text-decoration: underline; text-underline-offset: 2px; }
.markdown-body a:hover { color: hsl(var(--primary)); }
.markdown-body table { width: 100%; margin: 1em 0; border-collapse: collapse; }
.markdown-body th, .markdown-body td { padding: 0.5em 0.75em; border: 1px solid hsl(var(--border)); text-align: left; }
.markdown-body th { background-color: hsl(var(--sidebar)); font-weight: 600; }
.markdown-body tr:nth-child(even) { background-color: hsl(var(--sidebar) / 0.5); }
.markdown-body img { max-width: 100%; border-radius: 8px; margin: 0.5em 0; }
```

## 23.2 使用方式

```tsx
// MessageMarkdown.tsx
<div className="markdown-body">
  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
    {content}
  </ReactMarkdown>
</div>
```

收藏区域预览区同样使用 `.markdown-body` 类名。

---

# 24. Favorite 编辑/预览分割

## 24.1 布局

```text
┌──────────────────────────┐
│ 编辑区（textarea）          │  ← 默认 50% 高度
├──────────────────────────┤  ← 可拖动分割线
│ 预览区（Markdown）        │  ← 默认 50% 高度
└──────────────────────────┘
```

## 24.2 拖动行为

- 分割线高度：16px，居中显示圆点指示器
- 拖动时：cursor = row-resize，body user-select = none
- 最小高度限制：编辑区和预览区各占整体高度的 **≥ 20%**
- 默认比例：编辑区 50%，预览区 50%

## 24.3 防止文本选中闪烁

- 分割线 `onMouseDown` 调用 `e.preventDefault()`
- 分割线内部圆点添加 `pointer-events-none`

---
