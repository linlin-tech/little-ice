# Little Ice 前端架构文档

> Tauri 2.x Desktop · MVP 阶段
> 配套文档：`docs/ux-specification.md`、`docs/design-system.md`
> 本文是**前端代码生成与维护的唯一事实源**（Single Source of Truth）。

---

## 0. 文档说明

### 0.1 读者

- VSCode / Cursor 中的 AI 编码助手（每次启动新会话时请把本文 + UX 文档一起喂给模型）
- 项目前端开发者

### 0.2 目标

把以下"AI 不应自由发挥"的内容**一次性锁死**：

- 技术栈与版本
- 目录结构
- 数据模型
- 前后端命令契约
- AI 流式事件契约
- 状态管理切分
- 关键实现模式（自动保存、草稿持久化、状态机、确认弹窗）

### 0.3 不在本文范围

- 视觉设计（颜色、字号、间距）→ 由 shadcn/ui 默认主题 + Tailwind 工具类决定
- Rust 端实现 → 由后端架构文档约束
- MVP 范围 → 见 UX 文档第 16 章

---

## 1. 技术栈（Locked）

| 类别 | 选型 | 版本 | 备注 |
|---|---|---|---|
| 构建工具 | Vite | ^5 | Tauri 2.x 官方推荐 |
| 框架 | React | ^18 | |
| 语言 | TypeScript | ^5 | `strict: true` |
| 样式 | Tailwind CSS | ^3 | |
| 组件库 | shadcn/ui | latest | Radix + Tailwind，按需复制源码 |
| 状态管理 | Zustand | ^4 | 含 `persist` 中间件 |
| 路由 | **无** | — | 三个页面用 `appStore` 状态驱动 |
| Markdown | react-markdown + remark-gfm | latest | AI 回复渲染 |
| 代码高亮 | rehype-highlight | latest | |
| 图标 | lucide-react | latest | shadcn/ui 默认 |
| 表单 | react-hook-form + zod | latest | API Key 输入等 |
| Tauri SDK | @tauri-apps/api | ^2 | |
| 对话框 | @radix-ui/react-dialog | latest | 替代 Tauri Dialog Plugin |
| Lint/Format | ESLint + Prettier | latest | |

> **禁止**：Ant Design / MUI / Mantine / Redux / React Router / styled-components / emotion。
> **已移除**：`@tauri-apps/plugin-dialog`（使用前端 Dialog 替代）。

---

## 2. 目录结构

```
little-ice/
├── docs/
│   ├── ux-specification.md           # UX 文档
│   └── frontend-architecture.md      # 本文档
├── src/
│   ├── main.tsx                      # 入口；挂载根布局、初始化 Tauri 监听
│   ├── App.tsx                       # 根布局：三栏（Sidebar / List / Content）
│   ├── components/
│   │   ├── ui/                       # shadcn/ui 组件（Button、Input、Dialog…）
│   │   ├── layout/                   # Sidebar、ListPanel、ContentPanel、AppShell
│   │   └── common/                   # ConfirmDialog、EmptyState、StatusBadge…
│   ├── features/
│   │   ├── chat/
│   │   │   ├── components/           # ChatList、ChatContent、MessageItem、ChatInput、MessageMarkdown
│   │   │   ├── hooks/                # useChatStream、useSendMessage
│   │   │   ├── store.ts
│   │   │   ├── api.ts                # Tauri command 封装
│   │   │   └── types.ts
│   │   ├── favorite/
│   │   │   ├── components/           # FavoriteList、FavoriteDetail、FavoriteItem、FavoriteToolbar、SaveStatusBar
│   │   │   ├── hooks/                # useFavoriteAutoSave
│   │   │   ├── store.ts
│   │   │   ├── api.ts
│   │   │   └── types.ts
│   │   └── settings/
│   │       ├── components/           # ApiKeyForm、AppearanceSection
│   │       ├── store.ts
│   │       ├── api.ts
│   │       └── types.ts
│   ├── stores/                       # 全局 store
│   │   ├── appStore.ts               # 当前页面、当前选中项、Sidebar 折叠状态
│   │   └── draftStore.ts             # 聊天草稿（Zustand persist）
│   ├── lib/
│   │   ├── tauri.ts                  # 类型安全 invoke 包装
│   │   ├── events.ts                 # AI 流式事件订阅封装
│   │   └── utils.ts                  # cn()、时间格式化等
│   ├── types/
│   │   └── models.ts                 # Chat / Message / Favorite / Settings
│   └── styles/
│       └── globals.css               # Tailwind 入口 + Markdown 样式
├── src-tauri/                        # Rust 端（不在本文档范围）
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json                   # shadcn/ui 配置
├── package.json
└── README.md
```

**关键约定**：
- 每个 `features/<name>/` 是一个**自包含的垂直切片**（store + api + components + hooks + types），不跨 feature 互相 import store；需要共享的东西放 `lib/` 或 `types/`。
- 路径别名统一使用 `@/`，由 `tsconfig.json` + `vite.config.ts` 配置。

---

## 3. 数据模型

`src/types/models.ts`：

```ts
// ===== 基础 ID（字符串，UUID） =====
export type Id = string;
export type Timestamp = number; // Unix 毫秒

// ===== Chat =====
export interface Chat {
  id: Id;
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== Message =====
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: Id;
  chatId: Id;
  role: MessageRole;
  content: string;
  createdAt: Timestamp;
}

// ===== Favorite =====
export interface Favorite {
  id: Id;
  title: string;
  content: string;
  sourceChatId: Id | null;      // 来源 Chat id；手动创建时为 null
  sourceMessageId: Id | null;    // 来源 Message id；手动创建时为 null。用于判断消息是否已被收藏
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== Settings =====
export interface Settings {
  deepseekApiKey: string; // 空串 = 未配置
  hasApiKey: boolean;     // 后端返回的便捷字段，避免前端正则判断
}

// ===== 状态枚举 =====
export type ViewMode = 'chat' | 'favorite' | 'settings';

export type ResourceStatus = 'empty' | 'loading' | 'ready' | 'error';

export type AiState =
  | 'idle'
  | 'sending'      // 用户消息已发送，等待首个 token
  | 'generating'   // 正在流式接收
  | 'completed'    // 成功完成
  | 'failed'       // 出错
  | 'stopped';     // 用户主动停止

export type DraftState = 'editing' | 'cached';
```

**约束**：
- `Timestamp` 一律 Unix 毫秒（number），不存 ISO 字符串
- `id` 由后端生成（UUIDv4 / nanoid），前端不构造
- `Message.content` 渲染前**必须**走 `react-markdown` 清洗管道

---

## 4. Tauri 命令契约（Rust ↔ Frontend）

所有命令通过 `invoke<T>(name, args)` 调用，类型签名在 `src/lib/tauri.ts` 中统一封装。

### 4.1 Chat

| 命令 | 参数 | 返回 | 副作用 |
|---|---|---|---|
| `create_chat` | `{ title: string }` | `Chat` | 写入 SQLite |
| `list_chats` | `{}` | `Chat[]` | 按 `updatedAt` 倒序 |
| `get_chat` | `{ id: Id }` | `Chat` |  |
| `rename_chat` | `{ id: Id, title: string }` | `Chat` | 更新 `updatedAt` |
| `delete_chat` | `{ id: Id }` | `void` | 同步删除关联 message |

### 4.2 Message

| 命令 | 参数 | 返回 | 副作用 |
|---|---|---|---|
| `list_messages` | `{ chatId: Id }` | `Message[]` | 按 `createdAt` 升序 |
| `send_message` | `{ chatId: Id, content: string }` | `{ userMessage: Message }` | 写用户消息；**异步**触发 AI 流（见 §5） |
| `delete_message` | `{ chatId: Id, assistantId: Id }` | `void` | **V1.5**：事务内删一对配对消息（user+assistant），解绑 favorites 的 `source_message_id`（保留收藏内容）；返回 `NotFound` 表示 id 不存在 |

> AI 助手的回复**不通过命令返回**，而是通过事件流（§5）。`send_message` 只保证用户消息已落库。
>
> `delete_message` 是 V1.5 引入的 **Message 级删除**（与 `delete_chat` 互补）：
> - 一次删除一个"回合"（user 提问 + assistant 回复），而不是整个 Chat
> - 收藏关联**解绑而非删除**（保留收藏本身，用户可继续手动编辑）
> - Chat 头部 ⭐ 徽章由 `count_by_chat` 实时统计，会自然下降
> - 后端 `delete_message` 不删除 Chat，即便删空也保留 Chat 记录

### 4.3 AI 控制

| 命令 | 参数 | 返回 | 副作用 |
|---|---|---|---|
| `stop_generation` | `{ chatId: Id }` | `void` | 中断对应 chat 的流；发出 `ai-stream-end { stopped: true }` |

### 4.4 Favorite

| 命令 | 参数 | 返回 | 副作用 |
|---|---|---|---|
| `create_favorite` | `{ title: string, content: string, sourceChatId: Id \| null, sourceMessageId: Id \| null }` | `Favorite` | `sourceChatId` 必传，从 AI 消息收藏时传当前 chat.id，手动创建传 null；`sourceMessageId` 用于关联消息收藏状态 |
| `list_favorites` | `{}` | `Favorite[]` | 按 `updatedAt` 倒序 |
| `get_favorite` | `{ id: Id }` | `Favorite` |  |
| `update_favorite` | `{ id: Id, patch: { title?: string; content?: string } }` | `Favorite` | 仅更新传入的字段；更新 `updatedAt`；**重命名走 `{ title }` patch** |
| `delete_favorite` | `{ id: Id }` | `void` |  |
| `count_favorites_by_chat` | `{ chatId: Id }` | `number` | 统计 `sourceChatId == chatId` 的数量 |
| `get_favorite_by_message_id` | `{ sourceMessageId: Id }` | `Favorite \| null` | 根据消息 ID 查找收藏，用于判断消息是否已被收藏 |

### 4.5 Settings

| 命令 | 参数 | 返回 | 副作用 |
|---|---|---|---|
| `get_settings` | `{}` | `Settings` | 首次启动时 `hasApiKey = false` |
| `set_api_key` | `{ key: string }` | `Settings` | 实时写入 SQLite；空串视作清除 |

### 4.6 错误约定

后端命令失败统一抛出 `Error`（含 `message`），前端用 try/catch 捕获后写入对应 store 的 `error` 字段并用 `Inline Message` 展示（UX 文档第 13 章）。

---

## 5. AI 流式事件契约

`src/lib/events.ts` 统一封装 `listen` / `emit`，事件名集中在 `AiEvent` 常量中。

### 5.1 事件名

```ts
export const AiEvent = {
  Start:   'ai-stream-start',
  Chunk:   'ai-stream-chunk',
  End:     'ai-stream-end',
  Error:   'ai-stream-error',
} as const;
```

### 5.2 Payload

```ts
export interface AiStreamStart {
  chatId: Id;
  assistantMessageId: Id;   // 预先生成的 ID，前端先用占位
}

export interface AiStreamChunk {
  chatId: Id;
  assistantMessageId: Id;
  delta: string;             // 本次新增的文本片段
}

export interface AiStreamEnd {
  chatId: Id;
  assistantMessageId: Id;
  fullContent: string;        // 完整内容，前端用于对账
  stopped: boolean;           // true = 用户主动停止
}

export interface AiStreamError {
  chatId: Id;
  assistantMessageId: Id;
  error: {
    type: 'network' | 'model' | 'timeout' | 'unknown' | 'api_key';
    message: string;
  };
}
```

### 5.3 状态机

```text
[用户点击发送]
  → 调 send_message → 立即拿到 userMessage
  → 写入 chatStore.messages
  → aiState: 'sending'
  → 监听到 ai-stream-start
  → aiState: 'generating'
  → 监听到 ai-stream-chunk（多次）
  → 监听到 ai-stream-end
  → aiState: 'completed' 或 'stopped'
  → 监听到 ai-stream-error
  → aiState: 'failed'
```

**关键点**：
- `assistantMessageId` 在 `ai-stream-start` 时已确定，前端立刻在 `messages` 数组里插入一条空 `content` 的占位消息
- 每个 chunk 到达时**追加**到该占位消息的 `content`
- 收到 `ai-stream-end` 后用 `fullContent` 校正一次（防止丢包）
- 切换 chat 时必须 `unlisten` 当前 chat 的事件订阅

---

## 6. 状态管理（Zustand）

### 6.1 appStore — `src/stores/appStore.ts`

```ts
interface AppState {
  view: ViewMode;
  selectedChatId: Id | null;
  selectedFavoriteId: Id | null;
  sidebarCollapsed: boolean;       // Sidebar 隐藏/展开状态

  setView: (v: ViewMode) => void;
  selectChat: (id: Id | null) => void;
  selectFavorite: (id: Id | null) => void;
  toggleSidebar: () => void;       // 切换 Sidebar 隐藏/展开
}
```

**职责**：纯 UI 导航状态，不持久化。

### 6.2 draftStore — `src/stores/draftStore.ts`

```ts
interface DraftState {
  draft: string;                // 当前输入框草稿
  draftState: DraftState;
  setDraft: (s: string) => void;
  clearDraft: () => void;
}
```

**职责**：仅保存"聊天输入框未发送内容"。**必须**使用 `persist` 中间件：

```ts
persist(..., {
  name: 'little-ice-chat-draft',
  storage: createJSONStorage(() => localStorage),
})
```

- 发送成功后调用 `clearDraft()`
- 应用重启后自动恢复

### 6.3 settingsStore — `src/features/settings/store.ts`

```ts
interface SettingsState {
  settings: Settings;
  status: ResourceStatus;
  error: string | null;

  load: () => Promise<void>;                    // 调 get_settings
  saveApiKey: (key: string) => Promise<void>;   // 调 set_api_key
}
```

**职责**：启动时加载一次；保存时**实时**写库（无 Save 按钮，UX 文档第 14 章）。

### 6.4 chatStore — `src/features/chat/store.ts`

```ts
interface ChatState {
  chats: Chat[];
  status: ResourceStatus;
  error: string | null;

  currentChatId: Id | null;
  messages: Message[];
  messagesStatus: ResourceStatus;

  aiState: AiState;
  streamingMessageId: Id | null;
  streamingDeltaBuffer: string;     // 容错用

  favoriteCount: number;            // 当前 chat 被收藏次数

  // actions
  loadChats: () => Promise<void>;
  createChat: (title: string) => Promise<Chat>;
  deleteChat: (id: Id) => Promise<void>;
  renameChat: (id: Id, title: string) => Promise<void>;   // 列表 hover 编辑 / Header 点击重命名都走这个
  selectChat: (id: Id) => Promise<void>;

  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => Promise<void>;

  loadFavoriteCount: (chatId: Id) => Promise<void>;

  /** V1.5：删除一条 AI 回复（连同配对的 user 提问）；乐观更新 + 失败回滚 */
  deleteMessage: (assistantMessageId: Id) => Promise<void>;

  // event handlers (在 main.tsx 中注册)
  onStreamStart: (p: AiStreamStart) => void;
  onStreamChunk: (p: AiStreamChunk) => void;
  onStreamEnd: (p: AiStreamEnd) => void;
  onStreamError: (p: AiStreamError) => void;
}
```

**关键不变量**：
- `streamingMessageId` 与 `messages` 数组中最后一条 `assistant` 消息的 id 一致
- 切换 `currentChatId` 时清空 `messages`、`aiState = 'idle'`、`streamingMessageId = null`
- 流式期间（`streamingMessageId !== null`）不允许删除该 message（UI 禁用）

**`deleteMessage` 语义（V1.5）**：
- 传入被点击的 AI 回复 `assistantMessageId`
- 乐观更新：立刻从 `messages` 移除两条（assistant + 紧邻的前一条 user）
- 调后端 `delete_message`（§4.2）：成功 → 通知 `favoriteStore.removeByMessageId` + 刷新 `favoriteCount`；失败 → 回滚到原始 messages
- 调用后 UI 自然滚动到原位置的前一条消息（follow-mode 重计算）

### 6.5 favoriteStore — `src/features/favorite/store.ts`

```ts
interface FavoriteState {
  favorites: Favorite[];
  status: ResourceStatus;
  error: string | null;

  currentFavoriteId: Id | null;
  currentFavorite: Favorite | null;

  isDirty: boolean;            // 内容/标题变化即置 true
  isSaving: boolean;
  lastSavedAt: Timestamp | null;

  loadFavorites: () => Promise<void>;
  createFavorite: (title: string, content: string, sourceChatId: Id | null, sourceMessageId?: Id | null) => Promise<Favorite | null>;
  selectFavorite: (id: Id) => Promise<void>;
  renameFavorite: (id: Id, title: string) => Promise<void>;   // 列表 hover 编辑 / 详情页 Enter & Blur 都走这个
  updateContent: (id: Id, content: string) => Promise<void>;   // 自动+手动保存（仅内容，标题走 renameFavorite）
  manualSave: () => Promise<void>;
  deleteFavorite: (id: Id) => Promise<void>;   // 仅列表 hover 区触发

  /** V1.5：消息删除后本地解除 favorite 的 source 指针（无后端调用） */
  removeByMessageId: (sourceMessageId: Id) => void;

  // utility
  clearError: () => void;
}
```

**`removeByMessageId` 语义（V1.5）**：
- 由 `chatStore.deleteMessage` 在后端删除成功后调用
- **仅本地同步**：遍历 `favorites`，找到 `sourceMessageId` 匹配的项，把 `sourceChatId` + `sourceMessageId` 都置 null
- 不调后端（后端事务已处理）
- 不删除收藏内容（用户可继续手动编辑）
- `currentFavorite` 命中时同步更新

---

## 7. 关键实现模式

### 7.1 Favorite 自动保存（isDirty + 10s 轮询）

`src/features/favorite/hooks/useFavoriteAutoSave.ts`：

```ts
export function useFavoriteAutoSave() {
  const { isDirty, isSaving, currentFavoriteId, manualSave } = useFavoriteStore();

  useEffect(() => {
    if (!currentFavoriteId) return;
    const timer = setInterval(() => {
      if (isDirty && !isSaving) {
        manualSave();   // 内部：调 update_favorite + 重置 isDirty
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [currentFavoriteId, isDirty, isSaving, manualSave]);
}
```

**规则**（UX 文档第 11 章）：
- 标题变化 → 调 `updateTitle`，**不走** 10s 轮询，**实时保存**（Enter / Blur 触发）
- 内容变化 → 只置 `isDirty = true`，由 hook 周期保存
- 切换 favorite / 卸载组件时若有 `isDirty` → 立即执行一次保存

### 7.2 Chat Draft 持久化

`draftStore` 用 `persist`，键 `little-ice-chat-draft`。**只在**：
- 用户键入时 `setDraft`
- 发送成功后 `clearDraft`

不要把 `messages` 或 `aiState` 放进 persist。

### 7.3 AI 状态机（TypeScript discriminated union）

在 `chatStore` 中以**字符串字面量**形式表达，确保非法转移在编译期被阻止（可选：用 reducer / XState，但 MVP 用 if 即可）：

```ts
function transitionAiState(
  current: AiState,
  event: 'start' | 'chunk' | 'end' | 'error' | 'stop'
): AiState {
  // 表格见 UX 文档第 9 / 12 章
  // sending --start--> generating
  // generating --chunk--> generating
  // generating --end--> completed
  // generating --error--> failed
  // sending|generating --stop--> stopped
}
```

### 7.4 确认对话框（删除操作）

UX 文档第 6 章：删除 Chat / Message / Favorite / 取消收藏需确认。

封装 `src/components/common/ConfirmDialog.tsx`，使用 @radix-ui/react-dialog 实现 shadcn/ui 风格 Dialog：

```tsx
// 全局单例组件，在 App 顶层挂载
export function ConfirmDialog(): React.JSX.Element | null { ... }

// 触发函数，返回 Promise<boolean>
export async function confirmDestructive(message: string): Promise<boolean> { ... }
```

**触发位置**：
- Chat 删除：`ChatList` 列表项 hover → 删除图标
- **Message 删除（V1.5）**：`MessageItem` 中 AI 消息 hover → 删除图标（`confirmDestructive("删除这条消息？\n将同时删除用户提问和 AI 回复")`）
- Favorite 删除：**`FavoriteList` 列表项 hover → 删除图标**（详情页无此入口，避免与保存误触）
- 取消收藏：`MessageItem` 中已收藏的 AI 消息点击收藏图标

**禁止**自建复杂业务弹窗（编辑弹窗、向导弹窗、多层嵌套弹窗）。

**已移除 `@tauri-apps/plugin-dialog`**：使用前端 Dialog 替代系统 Dialog。

### 7.5 首次启动检测

`main.tsx`：

```ts
const settings = await invoke<Settings>('get_settings');
if (!settings.hasApiKey) {
  // 跳到 settings 页面
  useAppStore.getState().setView('settings');
}
```

UX 文档第 15 章。

### 7.6 Tauri invoke 类型安全包装

`src/lib/tauri.ts`：

```ts
import { invoke } from '@tauri-apps/api/core';

export const tauri = {
  createChat: (title: string) => invoke<Chat>('create_chat', { title }),
  listChats: () => invoke<Chat[]>('list_chats'),
  // ... 其余命令按 §4 表格一对一封装
} as const;
```

每个 feature 的 `api.ts` 引入 `tauri` 再做语义化包装（例如 `chatApi.sendMessage(chatId, content)`）。

### 7.7 Tauri 事件订阅封装

`src/lib/events.ts`：

```ts
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { AiEvent, AiStreamStart, AiStreamChunk, AiStreamEnd, AiStreamError } from '@/types/ai';

export const aiEvents = {
  onStart:   (cb: (p: AiStreamStart) => void)   => listen<AiStreamStart>(AiEvent.Start,   e => cb(e.payload)),
  onChunk:   (cb: (p: AiStreamChunk) => void)   => listen<AiStreamChunk>(AiEvent.Chunk,   e => cb(e.payload)),
  onEnd:     (cb: (p: AiStreamEnd) => void)     => listen<AiStreamEnd>(AiEvent.End,       e => cb(e.payload)),
  onError:   (cb: (p: AiStreamError) => void)   => listen<AiStreamError>(AiEvent.Error,     e => cb(e.payload)),
};
// listen 返回 UnlistenFn，调用方负责在 unmount 时调用
```

---

## 8. UI 组件清单（按模块）

### 8.1 公共

- `AppShell`：三栏布局容器（Sidebar 240 / List 320 / Content 自适应），支持 Sidebar 隐藏/展开
- `Sidebar`：Logo + 顶部菜单（对话/收藏）+ 底部菜单（设置）+ 可隐藏/展开
- `ListPanel`：根据 `appStore.view` 渲染对应列表 + Toolbar
- `ContentPanel`：根据 `appStore.view` 渲染对应内容
- `EmptyState`：列表/内容为空时展示
- `ConfirmDialog`（基于 @radix-ui/react-dialog 的 shadcn/ui 风格 Dialog）
- `InlineMessage`：成功/错误提示（行内）

### 8.2 Chat

- `ChatToolbar`：MessageSquare 图标 + "对话" 文字 + 对话数量徽章（数量=0时灰色，>0时亮起）+ `New Chat` 按钮（Soft 风格）
- `ChatList`：列表项显示标题 + 更新时间（相对时间，如 "3 分钟前"）；hover 时右侧显示**编辑 + 删除**两个图标
  - 编辑：进入行内编辑模式（input 替换 title），Enter / Blur 确认 → 调 `renameChat`；Esc 取消
  - 删除：调 `confirmDestructive` → 调 `deleteChat`
- `ChatContent`：
  - `Header`：左侧当前 chat 标题（点击进入重命名模式） + 右侧收藏数徽章 `⭐ N`（N=0 时空心灰色，N>0 时实心蓝色）。**不显示**"收藏"图标按钮和"更多"图标按钮。
  - `MessageList`：倒序/正序渲染（最新在底），按 `role` 区分样式
  - `MessageItem`：用户右对齐、AI 左对齐、system 居中灰；AI 消息 hover 显示 **Copy + Favorite + Delete（V1.5）** 三个 IconButton
    - Delete：流式期间 disabled；点击 → `confirmDestructive` → `chatStore.deleteMessage`
  - `ChatInput`：textarea（rows=3）+ Send / Stop 切换按钮；宽度与 Content Panel 一致
  - 状态指示：`aiState` 决定按钮文案与 loading 动画
- `MessageMarkdown`：Markdown 渲染，使用 `.markdown-body` 全局样式类

### 8.3 Favorite

- `FavoriteToolbar`：Star 图标 + "收藏" 文字 + 收藏数量徽章（数量=0时灰色，>0时亮起）
- `FavoriteList`：标题 + 更新时间 + dirty 标记；hover 时右侧显示**编辑 + 删除**两个图标
  - 编辑：进入行内编辑模式 → 调 `renameFavorite`
  - 删除：调 `confirmDestructive` → 调 `deleteFavorite`
- `FavoriteDetail`：
  - `Title`：受控 input，Enter / Blur 触发实时保存（调 `renameFavorite`）
  - `Editor`：受控 textarea，变化时调 `updateContent` 置 `isDirty = true`
  - `Markdown Preview`：实时渲染 Markdown，支持拖动分割线调整编辑/预览高度（各占50%，最小高度20%）
  - `SaveButton`：手动保存按钮（isDirty=false 时 disabled 灰色，isDirty=true 时 Primary 可点击；保存中只显示 spinner）
  - 删除入口仅在 `FavoriteList` 列表项 hover 区
  - **V1.5**：`sourceMessageId` 已被消息删除置 null 时，详情页仍可正常编辑收藏本身（仅失去"来源跳转"能力）

### 8.4 Settings

- `ApiKeyForm`：受控 input，blur 或 debounce 500ms 实时保存
- `AppearanceSection`：Light Theme（MVP 只展示，不做切换）

---

## 9. 编码规范

### 9.1 TypeScript

- `tsconfig.json` 启用 `strict: true`、`noUncheckedIndexedAccess: true`
- **禁止** `any`；必要时用 `unknown` + 收窄
- 所有 store 状态、组件 props、API 返回值必须显式类型
- 用 `interface` 定义对象类型，`type` 定义联合/工具类型

### 9.2 React

- 函数组件 + Hooks，**禁止** class 组件
- Props 解构后使用：`function Foo({ a, b }: FooProps) {}`
- 副作用放 `useEffect`，事件回调用 `useCallback`（按需）
- **禁止** 在 render 中直接修改 state / 调命令

### 9.3 命名

| 类型 | 规则 | 示例 |
|---|---|---|
| 组件文件 | PascalCase.tsx | `ChatList.tsx` |
| Hook 文件 | camelCase.ts，use 前缀 | `useChatStream.ts` |
| Store 文件 | camelCase.ts | `chatStore.ts` |
| 工具/常量 | camelCase.ts | `tauri.ts` |
| 组件名 | PascalCase | `ChatList` |
| 变量/函数 | camelCase | `loadChats` |
| 常量 | UPPER_SNAKE | `AI_STREAM_INTERVAL` |
| 类型 | PascalCase | `AiState` |

### 9.4 导入顺序

```ts
// 1. 外部库
import { useState } from 'react';
// 2. @tauri-apps
import { invoke } from '@tauri-apps/api/core';
// 3. @/ 别名
import { Chat } from '@/types/models';
import { useChatStore } from '../store';
// 4. 相对路径
import { ChatItem } from './ChatItem';
// 5. 样式
import './styles.css';
```

### 9.5 错误处理

- 所有 `invoke` 调用必须 `try / catch`
- 错误统一写入对应 store 的 `error` 字段
- UI 用 `InlineMessage` 展示，不弹 alert / 不阻塞

### 9.6 日志

- 开发环境用 `console.log/warn/error` 即可
- **禁止**打印 `deepseekApiKey` 等敏感字段
- 生产构建移除 `console.log`（Vite `esbuild.drop`）

---

## 10. 性能与体验底线

- 输入响应：草稿键入**零延迟**写入 localStorage（Zustand persist 同步）
- 列表渲染：> 100 条时虚拟滚动（`@tanstack/react-virtual`），MVP 可暂不引入但预留
- 流式渲染：chunk 到达后**追加**到 React state，单帧更新（避免 `setState` 风暴可加 microtask 批处理，MVP 可选）
- 启动时间：首屏 < 1s（Vite + Tauri 原生窗口）

---

## 11. MVP 范围

完全对齐 UX 文档第 16 章。

**包含**：Chat、Favorite、Settings

**不包含**：Project / Folder / Search / Tag / Category / Knowledge Graph / Mind Map / Workspace / Multi Window / System Tray / Native Menu / Import / Export / Multi Theme / Multi Model / Agent Workflow / **批量删除**

**遇到需求方要求加新模块 → 先回看本文档与 UX 文档，不在范围内的功能需要先扩展两份文档。**

---

## 12. 如何使用本文档（给 VSCode LLM 用）

每次开启新的 AI 编码会话，**先发这段提示词**：

```text
你是 Little Ice 项目的 React + Tauri 2.x 前端工程师。
你必须严格遵守以下两份文档（按顺序阅读）：
1. docs/ux-specification.md      （产品 UX 规范）
2. docs/frontend-architecture.md （前端架构，Single Source of Truth）

约束：
- 任何与本文档冲突的"行业最佳实践"以本文档为准
- 不在 MVP 范围内的功能直接拒绝实现，并提示需要先更新文档
- 不引入本文档禁止的库（见 §1）
- 不修改 Tauri 命令契约（见 §4）— 如需改动，先报告
- 写代码前先说你要改哪些文件、为什么
- 代码风格遵循 §9
```

随后将本次具体需求附上即可。

---