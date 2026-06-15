# Little Ice MVP UX Specification V5.5

## Tauri 2.x Desktop Edition

> V5.5 变更（基于 V5.4）：
> - §8 Chat Content Header：**恢复**右侧收藏数徽章；同时**去掉**右侧"收藏"和"更多"两个图标按钮（Header 只保留徽章 + 标题）
> - Chat 列表项 meta：仍不显示 ⭐ N（保持 V5.4 决定）
> - §5 数据模型：`sourceChatId` 字段恢复使用
> 
> V5.4 变更（基于 V5.3）：
> - §8 Chat Content Header：右侧**留空**，不再显示收藏数（等待后续确定）
> - §5 数据模型：`sourceChatId` 字段保留，但 V5.4 无 UI 消费
> 
> V5.3 变更（基于 V5.2）：
> - §5 数据模型：Favorite 增加 `sourceChatId` 字段
> - §8 Chat 模块：Chat List 增加"重命名"操作；Chat Content Header 右侧显示该 Chat 的收藏数
> - §10 Favorite 模块：Favorite List 增加"重命名"操作；Favorite Detail 删除按钮移除（保留在列表 hover 区）
> - §13 状态反馈：增加"已重命名"反馈

---

# 1. 文档信息

| 项目   | 内容                 |
| ---- | ------------------ |
| 产品名称 | Little Ice（小冰）     |
| 文档类型 | UX Specification   |
| 版本   | V5.5               |
| 产品阶段 | MVP                |
| 平台   | Tauri 2.x Desktop  |
| 前端   | React + TypeScript |
| 后端   | Rust               |
| 数据库  | SQLite             |
| 状态管理 | Zustand            |
| AI服务 | DeepSeek           |

---

# 2. 产品定位

Little Ice 是一个桌面端 AI 对话管理工具。

核心目标：

```text
Chat
↓
Favorite
↓
Knowledge Collection
```

帮助用户长期沉淀 AI 对话中的高价值内容。

---

# 3. UX设计原则

（同 V5.2，未变）

---

# 4. 信息架构（IA）

```text
Little Ice

├── Chat
├── Favorite
└── Settings
```

---

# 5. 核心对象模型

## Chat

```text
id
title
createdAt
updatedAt
```

## Message

```text
id
chatId
role
content
createdAt
```

## Favorite

```text
id
title
content
sourceChatId    // V5.3 新增：来源 Chat id，可为 null（手动创建）
createdAt
updatedAt
```

## Settings

```text
deepseekApiKey
```

---

# 6. Tauri窗口架构

（同 V5.2，未变）

---

# 7. 主窗口布局

```text
┌──────────┬────────────────┬────────────────────┐
│ Sidebar  │ List Panel     │ Content Panel      │
│   240px  │     320px      │   自适应宽度         │
└──────────┴────────────────┴────────────────────┘
```

---

# 8. Chat模块

## 页面结构

```text
Chat

├── Toolbar
├── Chat List
└── Chat Content
```

## Toolbar

```text
New Chat
```

## Chat List

显示：

```text
标题

更新时间
```

排序：

```text
最近更新时间倒序
```

### V5.3 支持的列表项操作

每个 Chat 列表项 hover 时显示操作图标：

```text
[编辑]   [删除]
```

**编辑**：
- 点击后进入行内编辑模式
- 输入框 focus 原标题
- Enter 确认 / Esc 取消 / Blur 确认
- 实时保存到 SQLite（UX §11）

**删除**：
- 点击后弹确认框（UX §6 通用规则）

## Chat Content

```text
Header
Message List
Input Area
```

### Header（V5.3 引入，V5.4 简化，V5.5 重新调整）

```text
┌────────────────────────────────────────────────┐
│ [话题名称]                          [⭐ N]    │
└────────────────────────────────────────────────┘
```

**左侧**：
- 当前 Chat 标题
- 点击进入重命名（与列表项编辑行为一致）

**右侧**（V5.5 更新）：
- **仅显示**收藏数徽章 `⭐ N`
- N = 当前 Chat 被收藏的次数（`Favorite.sourceChatId == chat.id` 的数量）
- N = 0 时显示 `⭐ 0`，不隐藏（保持位置稳定）
- N > 99 时显示 `99+`
- 点击徽章：MVP 暂不响应，未来可跳转该 Chat 的收藏列表
- **不显示**"收藏"图标按钮（V5.5 移除）
- **不显示**"更多/三点"图标按钮（V5.5 移除）

### Message List

（同 V5.2，未变）

### Input Area

（同 V5.2，未变）

## Chat Draft

（同 V5.2，未变）

---

# 9. AI交互规范

（同 V5.2，未变）

---

# 10. Favorite模块

## 页面结构

```text
Favorite

├── Favorite List
└── Favorite Detail
```

## 支持功能

```text
收藏AI消息
编辑标题（列表 + 详情）
编辑内容（仅详情）
删除（仅列表 hover 操作区）
```

> V5.3 变更：
> - 标题"编辑"入口：列表 hover + 详情页 input
> - 内容"编辑"入口：仅详情页
> - "删除"入口：**仅列表 hover**（详情页底部不再保留删除按钮）

## 收藏流程

MVP 阶段：

```text
AI回答
↓
点击收藏
↓
sourceChatId = 当前 chat.id
↓
保存成功
```

## 列表项操作（V5.3 新增）

每个 Favorite 列表项 hover 时显示操作图标：

```text
[编辑]   [删除]
```

**编辑**：
- 点击后进入行内编辑模式
- 行为与 Chat 列表项编辑一致（实时保存）

**删除**：
- 点击后弹确认框

## 标题编辑

（同 V5.2：实时保存，Enter / Blur 触发）

## 内容编辑

（同 V5.2：自动 + 手动保存）

## 详情页底部（V5.3 变更）

详情页底部**仅保留 Save 按钮**，删除按钮移除。

```text
┌──────────────────────────────────────────┐
│ [保存状态]                       [保存]  │
└──────────────────────────────────────────┘
```

理由：删除是低频且破坏性操作，放在列表项 hover 区更合理，避免与保存高频操作误触。

---

# 11. 数据保存规范

（同 V5.2，未变）

> 补充：`update_favorite` 命令支持 `patch: { title?, content? }`，标题重命名通过 `{ title }` patch 实现。

---

# 12. 状态系统

（同 V5.2，未变）

---

# 13. 状态反馈规范

成功反馈：

```text
Saved           // 内容保存
Favorited       // 收藏成功
Deleted         // 删除成功
Renamed         // V5.3 新增：标题重命名成功
```

展示方式：

```text
按钮状态变化
页面状态变化
保存时间显示
```

错误反馈：（同 V5.2，未变）

---

# 14. 设置中心

（同 V5.2，未变）

---

# 15. 首次启动流程

（同 V5.2，未变）

---

# 16. MVP范围

（同 V5.2，未变）

---

# 17. UX交付结论

（同 V5.2，未变）

---

# 版本历史

| 版本 | 日期 | 变更 |
|---|---|---|
| V5.2 | — | 初版基线 |
| V5.3 | 2026-06-12 | Chat/Favorite 列表加编辑；Chat Header 显示收藏数；Favorite 详情删 Delete 按钮；Favorite 加 sourceChatId |
| V5.4 | 2026-06-12 | 撤回 Chat Header 收藏数（Header 右侧留空）；`sourceChatId` 字段保留但 V5.4 无 UI 消费 |
| V5.5 | 2026-06-12 | **恢复 Chat Header 收藏数徽章**；同时**去掉**Header 右侧"收藏"和"更多"两个图标按钮 |
