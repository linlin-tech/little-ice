# Little Ice Design System

---

# 1. Document Information

| Item     | Value                       |
| -------- | --------------------------- |
| Project  | Little Ice                  |
| Type     | Design System               |
| Platform | Desktop (Tauri 2.x)         |
| Frontend | React + TS + shadcn/ui + Tailwind |
| Language | Simplified Chinese          |
| Theme    | Light Only                  |

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

## 5.0 字体自托管

**问题**：跨平台部署时，macOS / Windows / Linux 系统可能**没有安装 Noto Sans SC**。浏览器 fallback 到系统默认中文字体（macOS = PingFang SC，Windows = Microsoft YaHei，Linux = WenQuanYi 等），这些字体的 **ascender / descender / em-square 指标不同**，会导致：

```text
- 图标与文字基线错位（SVG 在 baseline，中文在上方）
- 14px × leading-tight 文字顶划被切
- 同一个设计稿，在不同 OS 上看起来垂直偏移 1-3px
```

**解法**：把 Noto Sans SC 直接打包进前端 bundle，用 `@font-face` 注册，**不依赖系统安装**。

### 字体文件存放

```
src/
└── assets/
    └── fonts/
        ├── NotoSansSC-Regular.otf     (400)   必需
        ├── NotoSansSC-Medium.otf       (500)   推荐
        └── NotoSansSC-SemiBold.otf     (600)   推荐
```

> **最小可用**：只放 Regular 也能跑，浏览器会合成 Medium / SemiBold（synthetic bold，视觉略粗但能接受）。
> **理想状态**：三个字重都提供，渲染更精准。

**字体来源**：[Google Noto Fonts](https://fonts.google.com/noto/specimen/Noto+Sans+SC) 官方下载。也可使用 Adobe Source Han Sans（同一字体不同品牌名）。

### 版权 / License

SIL Open Font License 1.1（OFL）—— 可免费用于商业产品，**唯一要求**：保留版权声明。打包时把 `OFL.txt` 一同放到 `src/assets/fonts/` 目录。

## 5.1 字体声明

在 `src/styles/globals.css` 顶部（`@layer base` 之前）声明：

```css
/* === Noto Sans SC @font-face === */
@font-face {
  font-family: "Noto Sans SC";
  src: url("@/assets/fonts/NotoSansSC-Regular.otf") format("opentype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Noto Sans SC";
  src: url("@/assets/fonts/NotoSansSC-Medium.otf") format("opentype");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Noto Sans SC";
  src: url("@/assets/fonts/NotoSansSC-SemiBold.otf") format("opentype");
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
```

Vite 会自动解析 `@/assets/fonts/*.otf` 路径并打包到产物。开发期与生产构建都生效。

**全应用 font-family**（已通过 @font-face 自托管，不再依赖系统字体）：

```css
font-family: "Noto Sans SC", sans-serif;
```

### AI 回复的等宽字体

```css
/* JetBrains Mono 同样建议自托管，但 MVP 可先用系统 fallback */
font-family:
  "JetBrains Mono",
  "Fira Code",
  Consolas,
  "Courier New",
  monospace;
```

> **后续优化**：等宽字体也建议自托管，避免代码块在不同 OS 渲染不一致。MVP 阶段用 fallback 即可。

### 验证字体加载

打开 Tauri DevTools Console：

```js
document.fonts.ready.then(() => {
  console.log(document.fonts);  // 应看到 3 个 Noto Sans SC
});
```

或临时加 CSS：

```css
body::before {
  content: "字体测试: 设置 收藏 Chat";
  font-family: "Noto Sans SC", monospace;
  position: fixed; top: 0; right: 0; z-index: 9999;
  background: yellow; padding: 4px;
  font-size: 12px;
}
```

如果文字明显是 fallback 字体（PingFang / 微软雅黑），说明 @font-face 没生效——检查 `src` 路径和 `format` 是否正确。

## 5.2 字号 & 字重

| Token | Size | Weight | 用途 |
|---|---|---|---|
| `--text-brand` | 16px | 600（SemiBold） | Logo "小冰" |
| `--text-nav` | 14px | 400（Regular） | 侧边栏导航 |
| `--text-list-title` | 14px | 500（Medium） | Chat/Favorite 列表项标题 |
| `--text-list-meta` | 12px | 400（Regular） | 列表项时间戳 |
| `--text-message` | 15px | 400（Regular） | 消息正文（行高 1.9） |
| `--text-secondary` | 12px | 400（Regular） | 时间戳、占位提示 |
| `--text-code` | 13px | 400（Regular） | 代码块（等宽字体） |
| `--text-button` | 14px | 500（Medium） | 按钮文字 |

> 上述字重（400 / 500 / 600）都依赖对应字重文件。缺失时浏览器会合成（synthetic），视觉略有差异。**推荐**放齐 Regular / Medium / SemiBold 三个 .otf。

## 5.3 行高

| 场景 | line-height |
|---|---|
| 消息正文 | 1.9（阅读友好） |
| 列表项 | 1.4 |
| 导航 | 1.5 |
| 按钮 | 1 |

> 行高基于 Noto Sans SC 的字体内置 metric 设计。系统字体回退时行高可能视觉错位——**自托管后此问题消失**。如果仍遇到图标 / 文字垂直错位，先确认字体已正确加载。

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
| `--radius-lg` | 12px | Dialog |

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



## 9.2 Sidebar

```text
宽度：240px
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

## 9.3 List Panel

```text
宽度：320px
背景：--bg
顶部 Toolbar（仅 Chat 模块：New Chat 按钮）

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
| 模型角色 | `<Bot />` |
| 设置 | `<Settings />` |

> 新增「模型角色」导航项，与 Chat / Favorite / Settings 并列，作为一级模块。


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

**用途**：仅在**确认 Dialog 内部**使用（删除 Chat / Favorite 后的二次确认）。**列表项 hover 区**使用纯 IconButton 触发 Dialog，详情页不使用 Destructive Button。

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

## 12.6 列表项 IconButton

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

## 12.7 "..." 统一操作菜单

**用途**：Chat 列表项 hover 时的操作入口（替换原有的 Edit + Delete 并排图标）

### 12.7.1 触发按钮

```text
[···]
```

```css
/* 与 Ghost Button（§12.3）完全一致 */
size: 32×32px;
border-radius: --radius;    /* 8px */
background: transparent;
color: --text-secondary;

hover:
  background: --primary-hover;
  color: --text-primary;
```

### 12.7.2 Menu 弹出层

```css
position: absolute;           /* 或 Popover 组件 */
right: 16px;                  /* 与列表项右边界对齐 */
top: calc(100% + 4px);        /* 紧贴按钮下方 */
z-index: 50;
width: 160px;
background: --bg;             /* #FFFFFF */
border: 1px solid --border;   /* 1px 细边框 */
border-radius: --radius-md;   /* 10px */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); /* 轻微阴影 */
padding: 4px;
overflow: hidden;
```

### 12.7.3 一级菜单项

| 菜单项 | 样式 |
|---|---|
| 模型角色 ▶ | 主菜单，含展开箭头 `▶` |
| 编辑 | Ghost，文字 |
| 删除 | 文字 `--error`，hover 背景 `--primary-hover` |

```css
.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  font: --text-nav;           /* 14px / 400 */
  color: --text-primary;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
}

.menu-item:hover {
  background: --primary-hover;
}

.menu-item.destructive {
  color: --error;
}

.menu-item.destructive:hover {
  background: --primary-hover; /* 删除项不用红色背景，保持轻量 */
}

.menu-item .arrow {
  font-size: 10px;
  color: --text-secondary;
}
```

### 12.7.4 二级菜单（角色切换子菜单）

鼠标悬停「模型角色」后，弹出右侧子菜单：

```text
┌──────────────────┐   ┌──────────────────┐
│ 模型角色 ▶       │   │ ✓ 默认助手        │
│ 编辑             │   │   产品经理        │
│ 删除             │   │   UX设计师        │
└──────────────────┘   │   前端架构师      │
                        │   后端架构师      │
                        │   测试工程师      │
                        └──────────────────┘
```

```css
/* 子菜单：出现在主菜单右侧（submenu 模式） */
.submenu {
  position: absolute;
  left: calc(100% + 2px);   /* 紧贴主菜单右边界 */
  top: 0;
  width: 160px;
  background: --bg;
  border: 1px solid --border;
  border-radius: --radius-md;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  padding: 4px;
}

.submenu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  font: --text-nav;
  color: --text-primary;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
}

.submenu-item:hover {
  background: --primary-hover;
}

.submenu-item.active {
  color: --primary-strong;   /* 当前关联角色高亮 */
  font-weight: 500;
}

.submenu-item .check {
  width: 14px;
  height: 14px;
  color: --primary-strong;   /* ✓ 勾选符号 */
  flex-shrink: 0;
}
```

**选中态**：当前 Chat 关联的角色项文字加粗（`font-weight: 500`），前面显示 ✓ 图标。

**切换行为**：
- 点击子菜单项 → 立即更新 `chat.roleId` → 调用后端保存（无需确认 Dialog）
- 保存后：更新 Badge 显示 + 子菜单勾选态同步

### 12.7.5 实现建议

使用 `@radix-ui/react-dropdown-menu`（shadcn/ui 已集成）：

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button className="ghost-button">···</button>
  </DropdownMenuTrigger>
  <DropdownMenuContent side="bottom" align="end">
    <DropdownMenuItem className="submenu-trigger">
      模型角色 <ChevronRight className="arrow" />
      <DropdownMenuSeparator />
      {/* Radix submenu - 注意 DropdownMenuSub 结构 */}
    </DropdownMenuItem>
    <DropdownMenuItem onSelect={handleEdit}>编辑</DropdownMenuItem>
    <DropdownMenuItem className="destructive" onSelect={handleDelete}>删除</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

> 此 Menu **仅用于 Chat 列表**。Favorite / Model Role 列表保持 hover Edit + Delete 图标方式。

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
padding-left: 13px;            /* 抵消 border-left 3px */
```

**Hover 时显示 "..." 操作菜单**：

```text
┌─────────────────────────┐
│ Title                    [···] │
│ Updated 3 分钟前           │
└─────────────────────────┘
```

- 列表项右侧淡入 **"..." 菜单按钮**（32×32px，Ghost 样式）
- 点击展开 Menu：
  - **模型角色 ▶** → 子菜单，鼠标悬停展开（见 §12.7）
  - **编辑** → 点击后 Title 进入行内编辑模式（`<input>` 替换文字），Enter / Blur 确认，Esc 取消
  - **删除** → 点击后触发确认 Dialog
- 样式见 §12.7

> Chat 列表的 hover 操作由「Edit + Delete 图标并排」改为「"..." Menu 统一入口」，含角色切换子菜单。Favorite / Model Role 列表保持 hover Edit + Delete 图标不变。
>
> Chat 列表项 meta **不显示角色标签**，避免界面复杂化。角色信息仅在 Chat Header 标题下方显示（见 §14.0）。


## 13.4 行内编辑态

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

## 14.0 Chat Header 布局

```text
┌──────────────────────────────────────────────────────────┐
│ [话题名称]                     [⭐ N]  [角色徽章]         │
│ [当前角色名]                                               │
└──────────────────────────────────────────────────────────┘
```

```css
padding: 16px 24px 12px;       /* 底部收紧，给角色徽章留空间 */
border-bottom: 1px solid --border;
display: flex;
align-items: center;
justify-content: space-between;
gap: 12px;
```

**左侧**：Title（flex: 1，15px / 600，可点击重命名）。

**右侧**：Favorite Count Badge + 角色徽章。

**角色徽章**：

```text
[前端架构师]
```

```css
/* 标题行下方，紧贴标题右侧 */
display: inline-flex;
align-items: center;
gap: 4px;
padding: 2px 8px;
border-radius: 4px;
background: hsl(var(--sidebar));   /* #F8F9FB */
border: 1px solid hsl(var(--border)); /* #EAECEF */
font: 12px / 500;
color: hsl(var(--muted));          /* #6B7280 */
```

**规则**：
- 显示当前 Chat 关联的 Role.name
- 系统角色「默认助手」也正常显示徽章
- 徽章放在标题同一行右侧（如果标题太长，徽章换行到第二行）



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
- N = `chatStore.favoriteCount`，N = 0 时**也显示**（保持位置稳定，避免抖动）
- N > 99 时显示 `99+`
- 点击徽章：MVP 暂不响应（UX §8.2）

**规则**：Header 右侧**只显示**收藏数徽章，不显示"收藏"图标按钮。"..." 菜单入口在**列表项 hover** 而非 Header。

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
最大宽度：720px（与消息正文对齐）
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
- 清空数据（未来）

**禁止**用 Dialog 承载 Settings、编辑、向导等内容。



## 16.2 规格

```css
width: 420px
padding: 24px
background: --bg
border-radius: --radius-lg       /* 12px */
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

**不要**用 shadcn/ui 的 Dialog 组件做自定义内容。MVP 阶段统一使用 Tauri Dialog Plugin 的 `ask()`：

```ts
import { ask } from '@tauri-apps/plugin-dialog';

await ask('删除该 Chat？此操作不可撤销。', {
  title: '确认删除',
  kind: 'warning',
  okLabel: '删除',
  cancelLabel: '取消',
});
```

样式由系统 Dialog 渲染，不在前端样式系统管辖范围。

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

| isDirty | isSaving | 显示 |
|---|---|---|
| false | false | "已保存 · 14:23"（`--text-secondary`） |
| true | false | "有未保存的修改"（`--text-secondary`） |
| * | true | "保存中…"（`--text-secondary`，旁边 `<Loader2 />` 旋转 14px） |

**位置**：FavoriteDetail 编辑器底部，左对齐。

**Save 按钮**：

- isDirty = false：按钮 disabled（`--border` 背景）
- isDirty = true：按钮可用（Primary）
- isSaving = true：按钮显示 spinner

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

# 22. Model Role Page

> Model Role 用于管理 AI 模型角色。每个角色对应一套 Prompt 模板（responsibility），与 Chat 关联后作为 System Prompt 发送给模型。

## 22.1 页面布局

```text
┌──────────────┬────────────────────────────────────┐
│              │                                    │
│ Model Roles  │  Role Detail                      │
│              │                                    │
│ 默认助手      │  名称                              │
│ 产品经理      │  [input]                          │
│ UX设计师      │                                    │
│              │  职责                              │
│              │  [textarea]                        │
│              │                                    │
│              │                    [保存]          │
└──────────────┴────────────────────────────────────┘
```

- **左侧** Role List Panel：320px（与 Chat / Favorite 列表一致）
- **右侧** Role Detail Panel：自适应宽度，内边距 24px，内容最大宽度 480px
- 布局完全复用 Favorite 模块的左右分割结构

## 22.2 Role List（左侧）

Header：

```text
Model Roles                      [＋新建]
```

```css
display: flex;
align-items: center;
justify-content: space-between;
padding: 12px 16px;
border-bottom: 1px solid --border;

title: "Model Roles" (14px / 500)
button: Soft Button "＋新建" (右侧)
```

列表项（复用 §13 List Item）：

```text
默认助手（系统角色，不可编辑名称）
产品经理
UX设计师
前端架构师
```

- **系统角色**「默认助手」：列表项旁加 `<Bot />` 小图标，颜色 `--muted`，表示不可编辑 / 不可删除
- **自定义角色**：hover 显示 Edit + Delete 图标（与 Favorite 列表相同，§12.6 / §13.3）
- 选中态：与 Chat / Favorite 列表一致（`--primary-soft` 背景 + 左侧色条）

**新建行为**：
- 点击「＋新建」→ 在列表底部追加一个「未命名」新角色（自动进入编辑态）
- 新建的角色一定是自定义角色（`isBuiltin = false`）
- 不在列表内容区域显示「+ 新建」项（按钮在 Header 右侧）

## 22.3 Role Detail（右侧）

### 22.3.1 系统角色详情（只读）

```text
名称
默认助手

职责
你是一个乐于助人的 AI 助手。
```

```css
.name-display {
  font: 16px / 600;
  color: --text-primary;
}

.responsibility-display {
  font: --text-message;
  color: --text-secondary;
  line-height: 1.9;
}
```

- 整个 Detail 区域无编辑按钮，无保存按钮
- 布局与自定义角色 Detail 一致，视觉上体现为"纯展示"

### 22.3.2 自定义角色详情（可编辑）

**名称输入**：

```css
input {
  width: 100%;
  max-width: 480px;
  padding: 10px 14px;
  border: 1px solid --border;
  border-radius: --radius;     /* 8px */
  font: 16px / 600;
  color: --text-primary;
  outline: none;
}

input:focus {
  border-color: --primary;
  box-shadow: 0 0 0 3px rgba(124, 199, 255, 0.15);
}
```

**职责输入**：

```css
textarea {
  width: 100%;
  max-width: 480px;
  min-height: 120px;
  padding: 10px 14px;
  border: 1px solid --border;
  border-radius: --radius;
  font: --text-message;
  line-height: 1.9;
  color: --text-primary;
  resize: vertical;             /* 允许垂直拖拽 */
  outline: none;
}

textarea:focus {
  border-color: --primary;
  box-shadow: 0 0 0 3px rgba(124, 199, 255, 0.15);
}
```

**保存按钮**：

```text
[保存]
```

- 样式：Primary Button（§12.1）
- 行为：**实时保存**（blur 时自动保存，无显式 Save 按钮概念）
  - 用户停止输入 500ms 后自动写入 SQLite
  - 保存成功后按钮恢复 disabled
  - 若失败，显示 Inline Error（§17.2）

### 22.3.3 Detail Header

```text
Role 详情
```

```css
font: 20px / 600;
color: --text-primary;
margin-bottom: 20px;
```

## 22.4 Empty State

若所有自定义角色均被删除（不应发生，因为「默认助手」不可删除），显示：

```text
暂无自定义角色
点击左上角「＋新建」创建一个
```

## 22.5 数据模型

```text
Role
├── id          (UUIDv7)
├── name        (string, 必填，最大 50 字符)
├── responsibility (string, System Prompt，最大 4096 字符)
├── isBuiltin   (boolean, 默认 false)
├── createdAt   (Unix ms)
└── updatedAt   (Unix ms)
```

- `isBuiltin = true` 的角色：name 不可改，responsibility 不可改，不可删除
- `isBuiltin = false`：可自由编辑 / 删除

---

# 23. Settings Page

## 23.1 页面结构

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

## 23.2 API Key 输入

```css
input {
  width: 100%;
  max-width: 480px;
  padding: 10px 14px;
  border: 1px solid --border;
  border-radius: --radius;
  font: --text-message;
  font-family: monospace;       /* 密码风格字体 */
  letter-spacing: 0.05em;
}

input:focus {
  border-color: --primary;
  box-shadow: 0 0 0 3px rgba(124, 199, 255, 0.15);
  outline: none;
}
```

**保存反馈**（实时保存，无 Save 按钮）：
- 用户停止输入 500ms 后自动写入 SQLite
- 输入框下方显示 Inline 状态：
  - "已保存 · 14:23"（`--success`）
  - "保存失败，请重试"（`--error`）

**状态徽章**：

```text
未配置：红色文字 "未配置 API Key"
已配置：绿色文字 "✓ 已配置"
```

---

# 24. Implementation Notes

## 24.1 shadcn/ui 集成

**不修改 shadcn/ui 默认组件结构**，通过 `tailwind.config.ts` 和 `globals.css` 覆盖 CSS 变量来对齐本设计系统。

`src/styles/globals.css`：


```css
/* === Noto Sans SC @font-face（见 §5.0） === */
/* @font-face { ... } */

@layer base {
  :root {
    /* === Primary === */
    --primary: 199 100% 78%;          /* #7CC7FF → hsl */
    --primary-foreground: 0 0% 100%;

    --primary-soft: 211 100% 96%;     /* #EEF7FF */
    --primary-strong: 217 91% 60%;    /* #2563EB */
    --primary-tint: 204 100% 94%;     /* #E3F3FF */
    --primary-hover: 210 100% 98%;    /* #F5F9FF */

    /* === Neutral === */
    --background: 0 0% 100%;          /* #FFFFFF */
    --foreground: 220 14% 18%;        /* #1F2328 */

    --sidebar: 220 17% 98%;           /* #F8F9FB */
    --user-bubble: 220 14% 97%;       /* #F7F8FA */

    --border: 220 13% 92%;            /* #EAECEF */
    --muted: 220 9% 46%;              /* #6B7280 */

    /* === Feedback === */
    --success: 142 71% 36%;           /* #16A34A */
    --error: 0 72% 51%;               /* #DC2626 */
    --warning: 32 95% 44%;            /* #D97706 */

    /* === Radius === */
    --radius: 0.5rem;                 /* 8px */
  }
}
```

`tailwind.config.ts` 扩展：

```ts
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          soft: 'hsl(var(--primary-soft))',
          strong: 'hsl(var(--primary-strong))',
          tint: 'hsl(var(--primary-tint))',
          hover: 'hsl(var(--primary-hover))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        sidebar: 'hsl(var(--sidebar))',
        'user-bubble': 'hsl(var(--user-bubble))',
        border: 'hsl(var(--border))',
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted))' },
        success: 'hsl(var(--success))',
        error: 'hsl(var(--error))',
        warning: 'hsl(var(--warning))',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '12px',
      },
      fontFamily: {
        // Noto Sans SC 已通过 @font-face 注册，不再需要系统 fallback
        sans: ['"Noto Sans SC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      maxWidth: {
        content: '720px',
      },
    },
  },
};
```

## 24.2 使用建议

```tsx
// 选中态按钮
<Button className="bg-primary-soft text-primary-strong hover:bg-primary-tint">
  New Chat
</Button>

// 危险按钮
<Button variant="outline" className="text-error border-error hover:bg-red-50">
  Delete
</Button>

// 错误提示
<div className="border-l-[3px] border-error text-error text-xs flex items-center gap-1.5">
  <AlertCircle className="w-3.5 h-3.5" />
  <span>网络连接失败，请重试</span>
</div>
```

## 24.3 图标库

**统一使用 lucide-react**：

```ts
import { MessageSquare, Star, Settings, Send, Square, AlertCircle, Loader2, Trash2, Plus, Bot } from 'lucide-react';
```

**禁止**用 emoji 替代图标（💬⭐⚙ → MessageSquare / Star / Settings）。

---

# 25. MVP Page Map

| Page | 路由方式 | ContentPanel 内容 |
|---|---|---|
| 对话 | `appStore.view = 'chat'` | ChatContent（Header + MessageList + Input） |
| 收藏 | `appStore.view = 'favorite'` | FavoriteDetail（Title + Editor） |
| 模型角色 | `appStore.view = 'role'` | ModelRolePage（RoleList + RoleDetail） |
| 设置 | `appStore.view = 'settings'` | SettingsPage（AI Model） |

---
