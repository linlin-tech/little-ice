# Little Ice 实施 Checklist V1.0

> 配套文档：
> - `docs/ux-specification.md`（V5.5）
> - `docs/frontend-architecture.md`（V1.3）
> - `docs/backend-architecture.md`（V1.1）
> - `docs/design-system.md`（V1.4）
> - `preview.html`（视觉参考）
>
> 每一项就是一个交付节点。全部打勾 = MVP 完成。

---

## 0. 怎么用这份清单

1. **按顺序走**——前一步没通过不要跳到下一步
2. **每步开始前**，把"喂给 LLM 的提示词"复制到 VSCode LLM 会话开头
3. **每步结束**，跑"验证"段列出的命令，确认通过再打勾
4. **卡住了**——回到对应章节文档重读，对照实现是不是"自由发挥"了

预估总工时：2~3 个工作日（不包含 LLM 生成等待时间）。

---

## 工具前置检查

```bash
node --version       # >= 18
npm --version
rustc --version      # >= 1.75
cargo --version
cargo install tauri-cli --version "^2"   # 全局安装 Tauri CLI
```

```bash
# 项目根目录初始化（一次性）
npm create tauri-app@latest little-ice \
  --template react-ts \
  --manager npm \
  --identifier com.littleice.app \
  --yes
cd little-ice
```

---

# Phase 1：后端（Rust + Tauri）

## Step 1 · 项目结构 + 依赖

**目标**：搭好 src-tauri/ 骨架，所有依赖到位

**喂给 LLM 的提示词**：

```text
你是 Little Ice 的 Rust + Tauri 2.x 后端工程师。
请严格按以下文档实现：
1. docs/backend-architecture.md （核心约束）
2. docs/frontend-architecture.md §4 §5 （命令契约 + 事件契约）
本次任务：只搭项目骨架，不要写业务逻辑。
```

**任务**：

- [ ] 把 `docs/backend-architecture.md §2` 的目录结构创建出来（空文件 + 模块声明）
- [ ] 把 `docs/backend-architecture.md §11` 的 Cargo.toml 依赖写好
- [ ] 把 `docs/backend-architecture.md §12` 的 tauri.conf.json 写好
- [ ] 把 `docs/backend-architecture.md §13` 的 capabilities/default.json 写好
- [ ] `src/lib.rs` 写一个空的 `run()` 函数，能 `tauri::Builder::default().run(...)`
- [ ] 写 `src/main.rs` 调用 `lib::run()`

**验证**：

```bash
cd src-tauri
cargo check
```

应该看到 `Finished` 无错。

---

## Step 2 · 数据库 Schema

**目标**：迁移文件可执行，DB 自动创建

**喂给 LLM 的提示词**：

```text
（接 Step 1）
本次任务：实现数据库初始化。
- 写 migrations/20260612000001_initial.sql（按 §3.1）
- 写 src/db/pool.rs（按 §5.1）
- 在 lib.rs 的 setup() 里调 pool::init()
- 注意：开启外键约束（foreign_keys = ON）
- 错误处理用 AppError / AppResult（先在 error.rs 定义骨架）
```

**任务**：

- [ ] `migrations/20260612000001_initial.sql` 写好（4 张表 + 索引 + 初始 settings）
- [ ] `src/db/pool.rs` 写好
- [ ] `src/error.rs` 写好 `AppError` + `AppResult<T>` + `Serialize` impl
- [ ] `src/db/mod.rs` 导出 `pool`
- [ ] `src/lib.rs` 的 setup() 调用 `db::pool::init()`

**验证**：

```bash
cargo run
# 应该启动一个空白 Tauri 窗口
# 在 Tauri Devtools Console 执行：
# 找不到 console？直接看文件
ls ~/Library/Application\ Support/com.littleice.app/  # macOS
# 应该看到 little-ice.db 文件
sqlite3 ~/Library/Application\ Support/com.littleice.app/little-ice.db ".schema"
# 应该看到 4 张表
```

---

## Step 3 · Models + DB CRUD

**目标**：4 个模型 + 4 个 db 模块的 CRUD 函数

**喂给 LLM 的提示词**：

```text
（接 Step 2）
本次任务：实现数据访问层。
- 4 个 model 文件（§3.3）：注意 #[serde(rename_all = "camelCase")]
- 4 个 db 文件（§5.2 范例 + 同模式扩展）：chat / message / favorite / settings
- favorite 必须实现 count_by_chat(pool, chat_id) -> AppResult<i64>
- 不要写 Tauri 命令，只写底层函数
- 所有时间用 chrono::Utc::now().timestamp_millis()
- 所有 ID 用 uuid::Uuid::new_v7()
```

**任务**：

- [ ] `src/models/{chat,message,favorite,settings}.rs` 写好
- [ ] `src/db/chat.rs` 写好 `create / list_all / get / rename / delete / touch`
- [ ] `src/db/message.rs` 写好 `create / list_by_chat / update_content`，**注意 list_by_chat 用 ORDER BY id**
- [ ] `src/db/favorite.rs` 写好 `create / list_all / get / update / delete / count_by_chat`
- [ ] `src/db/settings.rs` 写好 `get / set`（key-value 风格）
- [ ] `src/db/mod.rs` 导出所有模块

**验证**：

```bash
cargo build
```

写一个临时测试函数（在 main.rs 里调一两个 CRUD），手动 insert 一条 chat，确认 DB 里能看到。

---

## Step 4 · Tauri 命令（不含 AI）

**目标**：除 send_message / stop_generation 外，所有命令可调用

**喂给 LLM 的提示词**：

```text
（接 Step 3）
本次任务：实现 Tauri 命令（不含 AI 相关的 send_message / stop_generation）。
严格按 docs/frontend-architecture.md §4 的签名：
- §4.1 chat：create_chat / list_chats / get_chat / rename_chat / delete_chat
- §4.2 message：list_messages
- §4.4 favorite：create_favorite / list_favorites / get_favorite / update_favorite / delete_favorite / count_favorites_by_chat
- §4.5 settings：get_settings / set_api_key
注意：
- 命令参数名要与前端一致（camelCase 还是 snake_case 看 serde 实际行为，Tauri 默认会转 camelCase 给前端）
- 返回类型都用 AppResult<T>
- 写 commands/mod.rs 统一导出
- 在 lib.rs 的 invoke_handler! 中注册所有命令
- favorite 接收 patch: { title?: string, content?: string } 用 FavoritePatch struct
```

**任务**：

- [ ] `src/commands/chat.rs` 5 个命令
- [ ] `src/commands/message.rs` 1 个命令
- [ ] `src/commands/favorite.rs` 6 个命令（含 `FavoritePatch` struct）
- [ ] `src/commands/settings.rs` 2 个命令
- [ ] `src/commands/ai.rs` 占位（先 `unimplemented!()`）
- [ ] `src/commands/mod.rs` 导出
- [ ] `lib.rs` 注册到 `invoke_handler!`
- [ ] `src/state.rs` 写好 `AppState` 骨架（先不放 active_streams）

**验证**：

```bash
cargo build
```

启动 `tauri dev`，在前端临时写个调用：

```ts
// 临时测试代码，验证后删掉
const chats = await invoke('list_chats');
console.log(chats);  // 应该是 []
```

```ts
await invoke('create_chat', { title: '测试' });
await invoke('list_chats');
// 应该看到 [{"id":"...","title":"测试",...}]
```

---

## Step 5 · DeepSeek 流式集成

**目标**：send_message + stop_generation 可用，AI 流能正常推送到前端

**喂给 LLM 的提示词**：

```text
（接 Step 4）
本次任务：实现 AI 流式生成。
严格按 docs/backend-architecture.md §7：
- ai/events.rs：4 个事件名常量 + 4 个 payload struct
- ai/client.rs：reqwest HTTP + 手写 SSE 解析
- ai/stream.rs：run_stream() 主流程
- 事件 emit 用 app.emit_all（前端会 listen）
- 取消用 tokio_util::sync::CancellationToken
- 错误处理：api_key / network / model / timeout 分类（§7.1 emit_error）
- 流的 assistant message 在流结束后用 update_content 写库
- 同时调 chat::touch 更新 chat 排序时间
- 取消时要 emit_end 时 stopped: true
```

**任务**：

- [ ] `src/ai/events.rs` 写好
- [ ] `src/ai/client.rs` 写好
- [ ] `src/ai/stream.rs` 写好
- [ ] `src/ai/mod.rs` 导出
- [ ] `commands/message.rs` 的 `send_message` 补完整（创建 assistant msg + tokio::spawn 流）
- [ ] `commands/ai.rs` 的 `stop_generation` 实现
- [ ] `state.rs` 的 `AppState` 加 `active_streams: Mutex<HashMap<Id, CancellationToken>>`

**验证**：

```bash
cargo build
```

启动 `tauri dev`，配置一个真实 API Key，临时测试：

```ts
await invoke('set_api_key', { key: 'sk-...' });
await invoke('send_message', { chatId: 'xxx', content: '你好' });
// 监听事件
import { listen } from '@tauri-apps/api/event';
await listen('ai-stream-chunk', (e) => console.log(e.payload));
await listen('ai-stream-end', (e) => console.log('end:', e.payload));
// 应该看到流式输出
```

---

## Step 6 · 从 Rust 自动生成 TS 类型

**目标**：前端能 `import type { Chat } from '@/types/generated'`

**喂给 LLM 的提示词**：

```text
（接 Step 5）
本次任务：集成 specta + specta-typescript，从 Rust 自动生成 TypeScript 类型。
- 选型：用 specta v2（比 ts-rs 更现代）
- 给所有需要导出的 struct 加 #[derive(Serialize, Deserialize, specta::Type)]
- 给命令函数加 #[tauri::command] #[specta::specta]
- 写一个 bin/gen_types.rs，运行后输出 src/types/generated.ts
- 配置 frontend 的 tsconfig 路径别名
```

**任务**：

- [ ] Cargo.toml 加 specta 依赖
- [ ] 给 `models/*.rs` 加 `#[derive(specta::Type)]`
- [ ] 给 `commands/*.rs` 函数加 `#[specta::specta]`
- [ ] 写 `src/bin/gen_types.rs` 生成器
- [ ] 运行 `cargo run --bin gen_types` 生成 `src/types/generated.ts`
- [ ] 验证生成文件与前端架构 §3 的 `models.ts` 一致

**验证**：

```bash
# 生成的 ts 文件应包含 Chat / Message / Favorite / Settings 四个 interface
cat src/types/generated.ts
# 字段名应该是 camelCase（不是 snake_case）
```

---

# Phase 2：前端基础

## Step 7 · 前端项目初始化

**目标**：React + Vite + TS + Tailwind + shadcn/ui 全部就绪

**喂给 LLM 的提示词**：

```text
你是 Little Ice 的 React + Tauri 2.x 前端工程师。
请严格按以下文档实现：
1. docs/frontend-architecture.md （技术栈、目录结构、命令契约）
2. docs/design-system.md §23.1 （Tailwind 主题 / CSS 变量）
3. docs/ux-specification.md （交互规则）
4. docs/backend-architecture.md §4 §5 （命令和事件契约）
5. src/types/generated.ts （Rust 自动生成的类型）
本次任务：初始化前端，配置主题，不写业务代码。
```

**任务**：

- [ ] 跑 `npx shadcn@latest init`，选 New York 风格 + Slate 基础色
- [ ] 把 `docs/design-system.md §23.1` 的 CSS 变量和 Tailwind 配置覆盖默认
- [ ] 装路径别名 `@/` → `src/`（tsconfig + vite.config）
- [ ] 创建 `docs/frontend-architecture.md §2` 的目录结构
- [ ] 删除 src-tauri/src/App.tsx 默认内容

**验证**：

```bash
npm run dev
# 应该能看到一个 1200x800 的空白窗口，背景色 #FFFFFF
```

---

## Step 8 · Tauri 封装 + Stores

**目标**：`@/lib/tauri` 和 5 个 store 全部就绪

**喂给 LLM 的提示词**：

```text
（接 Step 7）
本次任务：实现命令封装和状态管理。
- src/lib/tauri.ts：按 docs/frontend-architecture.md §4 + §7.6 封装 invoke
- src/lib/events.ts：按 §7.7 封装 AI 事件订阅
- src/stores/appStore.ts：§6.1
- src/stores/draftStore.ts：§6.2（注意 persist 中间件）
- src/features/settings/store.ts：§6.3
- src/features/chat/store.ts：§6.4
- src/features/favorite/store.ts：§6.5
所有 store 用 zustand 的 create<T>()(...) 形式（TS 严格模式）
所有 invoke 调用必须 try/catch，错误写 store 的 error 字段
```

**任务**：

- [ ] `src/lib/tauri.ts` 写好
- [ ] `src/lib/events.ts` 写好
- [ ] `src/stores/appStore.ts` 写好
- [ ] `src/stores/draftStore.ts` 写好
- [ ] `src/features/settings/store.ts` 写好
- [ ] `src/features/chat/store.ts` 写好（含 favoriteCount + loadFavoriteCount）
- [ ] `src/features/favorite/store.ts` 写好（含 renameFavorite）

**验证**：

```bash
npm run build
# TypeScript 编译应该零错误
```

临时在 App.tsx 加 console.log 验证 store 初始化无报错。

---

## Step 9 · 布局组件

**目标**：三栏布局 + Sidebar 导航能切换

**喂给 LLM 的提示词**：

```text
（接 Step 8）
本次任务：实现三栏布局 + 导航。
严格按 docs/design-system.md §9 §10 §11 §12：
- AppShell：三栏 grid (240 / 320 / 1fr)
- Sidebar：Logo + 三个 NavItem（用 lucide-react 图标）
- ListPanel：根据 appStore.view 渲染对应列表（先放占位文字）
- ContentPanel：根据 appStore.view 渲染对应内容（先放占位文字）
- NavItem 激活态用 §10.2 样式
所有组件用 shadcn/ui 基础（Button 可选用）
颜色 / 间距 / 圆角全部用 Tailwind 类名映射 design-system §23.1 的 token
```

**任务**：

- [ ] `src/components/layout/AppShell.tsx` 写好
- [ ] `src/components/layout/Sidebar.tsx` 写好
- [ ] `src/components/layout/ListPanel.tsx` 写好
- [ ] `src/components/layout/ContentPanel.tsx` 写好
- [ ] `src/App.tsx` 装配四个组件

**验证**：

```bash
npm run tauri dev
```

打开后应该看到：
- 左侧 240px Sidebar（Logo + 三个菜单）
- 中间 320px 空白
- 右侧自适应空白
- 点击菜单高亮切换
- 视觉与 preview.html 主页一致

---

# Phase 3：业务页面

## Step 10 · Chat 页面

**目标**：完整 Chat 功能可用

**喂给 LLM 的提示词**：

```text
（接 Step 9）
本次任务：实现 Chat 页面。
按 docs/frontend-architecture.md §8.2 拆组件 + docs/design-system.md §13 §14 §15：
- ChatList：列表项 hover 显示 Edit + Delete（用 lucide Pencil / Trash2）
  - Edit 进入行内编辑态（input 替换 title，Enter 提交）
  - Delete 调 confirmDestructive + deleteChat
- ChatToolbar：New Chat 按钮（soft style）
- ChatContent：
  - Header：左侧 Title（点击重命名）+ 右侧 favoriteCountBadge
  - MessageList：user 消息右对齐气泡 / AI 消息左对齐无气泡 / Markdown 渲染（react-markdown + remark-gfm + rehype-highlight）
  - AI 消息 hover 显示 Copy + Favorite 操作
  - ChatInput：textarea + Send/Stop 切换按钮
- 在 main.tsx 注册 AI 事件订阅，连接 chatStore 的 onStream* 方法
- selectChat 时同时调 loadFavoriteCount
- 订阅 cleanup 在切换 chat 时调用（用 useEffect return）
```

**任务**：

- [ ] `src/components/common/ConfirmDialog.tsx`（封装 tauri ask）
- [ ] `src/components/common/EmptyState.tsx`
- [ ] `src/components/common/InlineMessage.tsx`
- [ ] `src/features/chat/components/ChatList.tsx`
- [ ] `src/features/chat/components/ChatToolbar.tsx`
- [ ] `src/features/chat/components/ChatContent.tsx`
- [ ] `src/features/chat/components/ChatHeader.tsx`
- [ ] `src/features/chat/components/MessageList.tsx`
- [ ] `src/features/chat/components/MessageItem.tsx`
- [ ] `src/features/chat/components/ChatInput.tsx`
- [ ] `src/features/chat/hooks/useChatStream.ts`（事件订阅 hook）
- [ ] `main.tsx` 注册全局事件订阅

**验证**：端到端测一遍
- [ ] 点 New Chat 创建
- [ ] 发消息，AI 流式回复
- [ ] 列表 hover 出现 ✎ 和 🗑
- [ ] 点 ✎ 改标题，Enter 保存
- [ ] 点 🗑 弹确认框，确认后删除
- [ ] 切换 Chat，Header 右侧 ⭐ N 变化
- [ ] 收藏 AI 消息（从 hover 操作）
- [ ] Header 收藏数 +1
- [ ] 发消息中途点 Stop，流停止

---

## Step 11 · Favorite 页面

**目标**：Favorite CRUD + 自动保存可用

**喂给 LLM 的提示词**：

```text
（接 Step 10）
本次任务：实现 Favorite 页面。
按 docs/frontend-architecture.md §8.3 + docs/design-system.md §13 §20：
- FavoriteList：hover Edit + Delete
  - Edit 进入行内编辑态 → renameFavorite
  - Delete 弹确认 → deleteFavorite
- FavoriteDetail：
  - Title：受控 input，Enter / Blur 实时保存（调 renameFavorite）
  - Editor：受控 textarea
  - 底部：保存状态（"已保存 · 14:23" / "有未保存的修改"）+ Save 按钮（**无** Delete 按钮）
- src/features/favorite/hooks/useFavoriteAutoSave.ts：
  - setInterval 10s 检查 isDirty 并保存
  - 卸载时若有 isDirty 立即保存一次
- 创建 Favorite 的入口：从 AI 消息的 Favorite 按钮，弹一个简单的标题输入 Dialog
```

**任务**：

- [ ] `src/features/favorite/components/FavoriteList.tsx`
- [ ] `src/features/favorite/components/FavoriteDetail.tsx`
- [ ] `src/features/favorite/components/FavoriteEditor.tsx`
- [ ] `src/features/favorite/hooks/useFavoriteAutoSave.ts`
- [ ] `src/features/favorite/components/CreateFavoriteDialog.tsx`（标题输入）

**验证**：
- [ ] 收藏列表 hover 出现 ✎ + 🗑
- [ ] 改标题（列表行）实时保存
- [ ] 改标题（详情页）实时保存
- [ ] 改内容，10s 后自动保存
- [ ] 改内容时立即点 Save，立即保存
- [ ] 详情页**无** Delete 按钮
- [ ] 删除走列表 hover
- [ ] 切换 favorite 时若有未保存立即保存

---

## Step 12 · Settings 页面

**目标**：API Key 实时保存

**喂给 LLM 的提示词**：

```text
（接 Step 11）
本次任务：实现 Settings 页面。
按 docs/frontend-architecture.md §8.4 + docs/design-system.md §22：
- SettingsPage：AI Model 区块 + Appearance 区块
- ApiKeyForm：受控 input，debounce 500ms 实时保存
- 保存状态用 InlineMessage（成功绿色 / 失败红色）
- 状态徽章："✓ 已配置" / "未配置 API Key"
- Appearance 区块：Light 选中（disabled 状态）+ Dark 灰显（disabled）
- 启动时 get_settings()，若没 key 跳 settings 页面（§7.5）
```

**任务**：

- [ ] `src/features/settings/components/SettingsPage.tsx`
- [ ] `src/features/settings/components/ApiKeyForm.tsx`
- [ ] `src/features/settings/components/AppearanceSection.tsx`
- [ ] `main.tsx` 加首启检测

**验证**：
- [ ] 首次启动（无 key）自动跳 Settings
- [ ] 输入 key，500ms 后自动保存
- [ ] 显示"已保存 · 14:23"
- [ ] 状态徽章变 "✓ 已配置"
- [ ] 关闭重启，仍然显示已配置

---

# Phase 4：打磨 + 测试

## Step 13 · 状态反馈全覆盖

**目标**：UX §13 所有反馈场景都有对应 UI

**任务**：
- [ ] Save 按钮成功后文案变 "Saved" 2s 后恢复
- [ ] 消息旁 Star 图标点击后 fill 切换
- [ ] Favorite 详情页显示保存时间
- [ ] Inline 错误提示覆盖：API Key 错误 / 网络错误 / 模型错误 / 校验错误
- [ ] AI 状态指示：Sending 跳动点 / Generating 光标闪烁 / Stopped 角标
- [ ] EmptyState 覆盖：Chat 无对话 / Chat 无消息 / Favorite 无收藏

**喂给 LLM 的提示词**：

```text
（接 Step 12）
本次任务：补齐所有状态反馈。
按 docs/ux-specification.md §13 + docs/design-system.md §17 §18 §19：
- 4 种成功反馈（Saved / Favorited / Deleted / Renamed）各实现一次
- 4 种错误反馈（API Key / Network / Model / Validation）各实现 InlineMessage
- AI 状态机 5 个状态对应的 UI（idle / sending / generating / failed / stopped）
- 4 个 EmptyState 页面
- Cursor 闪烁动画（CSS keyframes blink）
- Loading 跳动点（CSS keyframes bounce）
```

---

## Step 14 · 集成测试

**目标**：所有 UX 流程跑通

**测试清单**（手动跑一遍）：

**Chat 流程**：
- [ ] 创建新 Chat
- [ ] 发消息
- [ ] AI 流式返回正常
- [ ] 收到完整内容后消息落库
- [ ] 重新打开 Chat，历史消息都还在
- [ ] 重命名 Chat
- [ ] 删除 Chat（确认）
- [ ] 草稿：输入内容不发送，重启 App 后内容恢复

**Favorite 流程**：
- [ ] 收藏 AI 消息
- [ ] 收藏出现在 Favorite 列表
- [ ] 从 Chat Header 看到收藏数 +1
- [ ] 列表行改标题
- [ ] 详情页改标题
- [ ] 详情页改内容，等 10s 看自动保存
- [ ] 手动 Save 立即保存
- [ ] 列表行删除（确认）
- [ ] 从 Chat Header 看到收藏数 -1
- [ ] 手动创建 Favorite（无 sourceChatId）

**Settings 流程**：
- [ ] 首次启动跳转 Settings
- [ ] 填 API Key 自动保存
- [ ] 错误 Key 报错
- [ ] 正确 Key 后回到 Chat 能发消息

**边界场景**：
- [ ] 杀进程（强制退出）后重启，数据不丢
- [ ] 网络断开时发消息，显示错误
- [ ] 流式生成中点 Stop，能停
- [ ] 流式生成中关闭 Chat，下次打开能看到已生成内容
- [ ] Favorite 内容改到一半切走，再切回来内容保留

---

## Step 15 · 打包

**目标**：产出可分发安装包

**任务**：
- [ ] `npm run tauri build` 跑通
- [ ] 检查产物大小（合理值：macOS .dmg < 50MB，Windows .msi < 60MB）
- [ ] 启动产物应用，从头跑一遍 Phase 4 测试清单
- [ ] 检查应用图标正确
- [ ] 检查应用名称 / identifier 正确

**产物路径**：
- macOS: `src-tauri/target/release/bundle/dmg/`
- Windows: `src-tauri/target/release/bundle/msi/`
- Linux: `src-tauri/target/release/bundle/appimage/` 或 `deb/`

---

# 完成 🎉

打完全部 15 步的勾 = Little Ice MVP 完成。

下一步可以考虑（MVP 范围外）：
- 导出 / 导入 Favorite
- Search 全文检索
- 多主题（Dark Mode）
- 多模型（Claude / GPT）
- 数据加密

---

## 版本

| 版本 | 日期 | 变更 |
|---|---|---|
| 1.0 | 2026-06-12 | 初版，对齐全部 4 份设计文档的当前版本 |
