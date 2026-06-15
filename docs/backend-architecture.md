# Little Ice 后端架构文档

> Tauri 2.x Desktop · Rust 后端 · MVP 阶段
> 配套文档：
> - `docs/ux-specification.md`（V5.5）
> - `docs/frontend-architecture.md`（V1.3）—— **前后端命令契约的源**
> - `docs/design-system.md`（V1.4）
>
> 本文是**后端代码生成与维护的唯一事实源**（Single Source of Truth）。

---

## 0. 文档说明

### 0.1 读者

- VSCode / Cursor 中的 AI 编码助手（每次启动新会话请把本文 + 前端架构 + UX 文档一起喂给模型）
- 项目后端 / 全栈开发者

### 0.2 目标

把以下"AI 不应自由发挥"的内容**一次性锁死**：

- 技术栈与版本
- 目录结构
- 数据库 Schema
- Tauri 命令实现契约（参数 / 返回 / 副作用）
- AI 流式事件契约
- 错误处理规范
- 状态管理

### 0.3 与前端架构的对应关系

| 前端架构章节 | 后端架构对应章节 |
|---|---|
| §3 数据模型 | §3 数据库 Schema |
| §4 Tauri 命令契约 | §6 命令实现（签名 + 行为） |
| §5 AI 流式事件契约 | §7 DeepSeek 集成 + 事件 |
| §6 Store 设计 | §5 AppState |
| §7 关键实现模式 | §8 错误处理 / §9 编码规范 |

**前端架构 §4 的命令参数和返回类型是后端实现的硬约束。**

---

## 1. 技术栈（Locked）

| 类别 | 选型 | 版本 | 备注 |
|---|---|---|---|
| 语言 | Rust | 2021 edition | stable |
| 框架 | Tauri | ^2 | 官方 |
| 异步运行时 | tokio | ^1 | Tauri 内置 |
| HTTP 客户端 | reqwest | ^0.12 | features: `["stream", "json", "rustls-tls"]` |
| SSE 解析 | `reqwest-eventsource` | ^0.6 | DeepSeek 流式响应 |
| 数据库 | SQLite | - | 单文件 `~/.local/share/little-ice/db.sqlite` |
| SQL 工具 | **sqlx** | ^0.8 | **不**用 `query!` 宏（避免编译期需要 DB），用 `query_as` / `query` |
| 序列化 | serde / serde_json | ^1 | |
| 错误处理 | thiserror + anyhow | latest | thiserror 用于对外，anyhow 用于内部 |
| ID 生成 | uuid | ^1 | features: `["v7"]` | **V1.1 改为 UUIDv7**（时间有序，可直接用于排序） |
| 时间 | chrono | ^0.4 | `Utc::now().timestamp_millis()` |
| 日志 | tracing + tracing-subscriber | latest | Tauri 内置 tracing |
| 配置 | tauri-plugin-store | ^2 | 预留（首启检测用 settings 表即可） |

**禁止**：diesel、sea-orm、actix-web、warp、axum、rocket（这是 Tauri 桌面端，不是 web server）。

---

## 2. 目录结构

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json                    # Tauri 应用配置
├── build.rs                           # Tauri 构建脚本
├── capabilities/
│   └── default.json                   # Tauri 2 权限声明
├── icons/                             # 应用图标
├── migrations/                        # SQL 迁移（sqlx）
│   └── 20260612000001_initial.sql
└── src/
    ├── main.rs                        # 入口（极薄）
    ├── lib.rs                         # 应用启动 + 模块导出
    ├── app.rs                         # Tauri Builder 配置
    ├── error.rs                       # AppError + Result 类型
    ├── state.rs                       # AppState
    ├── models/                        # 数据结构（与前端 §3 对齐）
    │   ├── mod.rs
    │   ├── chat.rs
    │   ├── message.rs
    │   ├── favorite.rs
    │   └── settings.rs
    ├── db/                            # 数据库访问层
    │   ├── mod.rs
    │   ├── pool.rs                    # SqlitePool 初始化
    │   ├── chat.rs                    # Chat 表 CRUD
    │   ├── message.rs
    │   ├── favorite.rs
    │   └── settings.rs
    ├── ai/                            # DeepSeek 集成
    │   ├── mod.rs
    │   ├── client.rs                  # AiClient（HTTP 客户端封装）
    │   ├── stream.rs                  # SSE 流解析 + 事件 emit
    │   └── events.rs                  # 事件名常量 + payload 类型
    └── commands/                      # Tauri 命令
        ├── mod.rs                     # 导出 + 注册入口
        ├── chat.rs                    # create_chat / list_chats / get_chat / rename_chat / delete_chat
        ├── message.rs                 # list_messages / send_message
        ├── favorite.rs                # create_favorite / list_favorites / get_favorite / update_favorite / delete_favorite / count_favorites_by_chat
        ├── settings.rs                # get_settings / set_api_key
        └── ai.rs                      # stop_generation
```

---

## 3. 数据库 Schema

数据库文件位置：`~/Library/Application Support/little-ice/db.sqlite`（macOS）/ 平台对应路径（Tauri 自动管理）

### 3.1 迁移文件

`migrations/20260612000001_initial.sql`：

```sql
-- ===== Chats =====
CREATE TABLE IF NOT EXISTS chats (
  id          TEXT PRIMARY KEY NOT NULL,
  title       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);

-- ===== Messages =====
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY NOT NULL,    -- UUIDv7，时间有序
  chat_id     TEXT NOT NULL,
  role        TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,             -- 保留用于显示（“14:23”），但不再用于排序
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);
-- V1.1 简化：UUIDv7 的 id 已时间有序，排序走 id 即可，只需 chat_id 索引
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);

-- ===== Favorites =====
CREATE TABLE IF NOT EXISTS favorites (
  id              TEXT PRIMARY KEY NOT NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  source_chat_id  TEXT,                 -- 允许为 NULL（手动创建）
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY (source_chat_id) REFERENCES chats(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_favorites_updated_at ON favorites(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_source_chat_id ON favorites(source_chat_id);

-- ===== Settings (key-value) =====
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

-- 初始 settings 行
INSERT OR IGNORE INTO settings (key, value) VALUES ('deepseek_api_key', '');
```

### 3.2 字段约定

| 字段 | 类型 | 约定 |
|---|---|---|
| `id` | TEXT | **V1.1 改为 UUIDv7**（`Uuid::new_v7().to_string()`，**时间有序**） |
| `*_at` | INTEGER | Unix **毫秒**（`Utc::now().timestamp_millis()`） |
| `role` | TEXT | 严格三选一：`user` / `assistant` / `system` |
| `source_chat_id` | TEXT NULL | NULL = 手动创建；非空 = 来自某 Chat |

**V1.1 选型说明（UUIDv7 vs UUIDv4）**：

UUIDv7 的高位 48 位是毫秒级时间戳，因此**字符串按字典序比较 ≈ 按时间排序**。带来的好处：

```text
1. 插入顺序天然有序，避免 B-Tree 频繁页分裂
2. 列表默认按 id 排序 = 按创建时间排序，无需额外索引
3. 可推断记录的创建时间（前端可近似展示“刚刚”）
```

对于按 `updated_at` 排序的表（chats / favorites），仍用 `updated_at` 索引；UUIDv7 在这里没收益但也没坏处，保持全局统一即可。

### 3.3 Rust 数据结构（`src/models/`）

`src/models/chat.rs`：

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chat {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
}
```

`src/models/message.rs`：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub chat_id: String,
    pub role: MessageRole,
    pub content: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
}
```

`src/models/favorite.rs`：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Favorite {
    pub id: String,
    pub title: String,
    pub content: String,
    pub source_chat_id: Option<String>,  // V5.5 启用：Chat 头部徽章用
    pub created_at: i64,
    pub updated_at: i64,
}
```

`src/models/settings.rs`：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub deepseek_api_key: String,
    pub has_api_key: bool,             // 由 deepseek_api_key 非空派生，前端便捷字段
}
```

**前后端字段名对齐**：Rust 用 `snake_case`，serde 自动转为 JSON `camelCase`（前端期望的命名）。需要时用 `#[serde(rename_all = "camelCase")]`。

---

## 4. AppState（应用全局状态）

`src/state.rs`：

```rust
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::ai::AiClient;
use crate::db::SqlitePool;

pub type Id = String;

pub struct AppState {
    pub db: SqlitePool,
    pub ai: Arc<AiClient>,

    /// 正在进行流式生成的 chat -> 取消令牌
    /// 用于 stop_generation 命令
    pub active_streams: Mutex<HashMap<Id, CancellationToken>>,
}
```

**注册到 Tauri**（`src/lib.rs`）：

```rust
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let db = crate::db::pool::init(&app.config())?;
            let ai = Arc::new(crate::ai::client::AiClient::new());
            app.manage(crate::state::AppState {
                db,
                ai,
                active_streams: Mutex::new(HashMap::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ... 所有命令
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 5. 数据库访问层

### 5.1 连接池

`src/db/pool.rs`：

```rust
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;

pub type DbPool = SqlitePool;

pub async fn init(_config: &tauri::Config) -> Result<DbPool, sqlx::Error> {
    // 路径由 Tauri 的 app_data_dir 管理
    let db_url = "sqlite://little-ice.db?mode=rwc";

    let opts = SqliteConnectOptions::from_str(db_url)?
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .foreign_keys(true);              // 开启外键约束

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(opts)
        .await?;

    // 运行迁移
    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}
```

### 5.2 CRUD 范例

`src/db/chat.rs`：

```rust
use super::DbPool;
use crate::models::Chat;
use crate::error::AppResult;

pub async fn create(pool: &DbPool, title: String) -> AppResult<Chat> {
    let now = chrono::Utc::now().timestamp_millis();
    let chat = Chat {
        id: uuid::Uuid::new_v7().to_string(),
        title,
        created_at: now,
        updated_at: now,
    };
    sqlx::query(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)"
    )
    .bind(&chat.id)
    .bind(&chat.title)
    .bind(chat.created_at)
    .bind(chat.updated_at)
    .execute(pool)
    .await?;
    Ok(chat)
}

pub async fn list_all(pool: &DbPool) -> AppResult<Vec<Chat>> {
    let chats = sqlx::query_as::<_, Chat>(
        "SELECT id, title, created_at, updated_at FROM chats ORDER BY updated_at DESC"
    )
    .fetch_all(pool)
    .await?;
    Ok(chats)
}

pub async fn get(pool: &DbPool, id: &str) -> AppResult<Chat> {
    let chat = sqlx::query_as::<_, Chat>(
        "SELECT id, title, created_at, updated_at FROM chats WHERE id = ?"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| crate::error::AppError::NotFound(format!("chat:{}", id)))?;
    Ok(chat)
}

pub async fn rename(pool: &DbPool, id: &str, title: String) -> AppResult<Chat> {
    let now = chrono::Utc::now().timestamp_millis();
    sqlx::query("UPDATE chats SET title = ?, updated_at = ? WHERE id = ?")
        .bind(&title)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
    get(pool, id).await
}

pub async fn delete(pool: &DbPool, id: &str) -> AppResult<()> {
    sqlx::query("DELETE FROM chats WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// 删除 chat 时同时 touch updated_at 影响排序
pub async fn touch(pool: &DbPool, id: &str) -> AppResult<()> {
    let now = chrono::Utc::now().timestamp_millis();
    sqlx::query("UPDATE chats SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
```

> `db/message.rs`、`db/favorite.rs`、`db/settings.rs` 同模式，按 §3 schema 实现 CRUD。Favorite 需提供 `count_by_chat(pool, chat_id) -> AppResult<i64>`。
>
> **V1.1 提醒**：`list_by_chat` 查询使用 `ORDER BY id`（UUIDv7 已时间有序），不要用 `created_at`，示例：
>
> ```rust
> pub async fn list_by_chat(pool: &DbPool, chat_id: &str) -> AppResult<Vec<Message>> {
>     sqlx::query_as::<_, Message>(
>         "SELECT id, chat_id, role, content, created_at FROM messages \
>          WHERE chat_id = ? ORDER BY id"
>     )
>     .bind(chat_id)
>     .fetch_all(pool)
>     .await
>     .map_err(Into::into)
> }
> ```

---

## 6. Tauri 命令实现

> 命令签名必须**严格匹配**前端架构 §4（参数名、返回类型、字段名）。
> 任何命令的修改需要**先改前端架构文档**。

### 6.1 Chat 命令（`src/commands/chat.rs`）

```rust
use tauri::State;
use crate::state::AppState;
use crate::models::Chat;
use crate::error::AppResult;

#[tauri::command]
pub async fn create_chat(
    state: State<'_, AppState>,
    title: String,
) -> AppResult<Chat> {
    crate::db::chat::create(&state.db, title).await
}

#[tauri::command]
pub async fn list_chats(state: State<'_, AppState>) -> AppResult<Vec<Chat>> {
    crate::db::chat::list_all(&state.db).await
}

#[tauri::command]
pub async fn get_chat(state: State<'_, AppState>, id: String) -> AppResult<Chat> {
    crate::db::chat::get(&state.db, &id).await
}

#[tauri::command]
pub async fn rename_chat(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> AppResult<Chat> {
    let chat = crate::db::chat::rename(&state.db, &id, title).await?;
    Ok(chat)
}

#[tauri::command]
pub async fn delete_chat(state: State<'_, AppState>, id: String) -> AppResult<()> {
    crate::db::chat::delete(&state.db, &id).await
}
```

### 6.2 Message 命令（`src/commands/message.rs`）

```rust
#[tauri::command]
pub async fn list_messages(
    state: State<'_, AppState>,
    chat_id: String,
) -> AppResult<Vec<Message>> {
    crate::db::message::list_by_chat(&state.db, &chat_id).await
}

/// 发送消息：
/// 1. 写 user message 到 DB
/// 2. 在 DB 预创建一条空的 assistant message（拿到 assistantMessageId）
/// 3. 异步触发 AI 流式生成
/// 4. 返回 { userMessage }
#[tauri::command]
pub async fn send_message(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    chat_id: String,
    content: String,
) -> AppResult<SendMessageResult> {
    // 1. 持久化用户消息
    let user_msg = crate::db::message::create(
        &state.db,
        &chat_id,
        MessageRole::User,
        content,
    ).await?;

    // 2. 预创建 assistant 消息
    let assistant_msg = crate::db::message::create(
        &state.db,
        &chat_id,
        MessageRole::Assistant,
        String::new(),  // 流式填充
    ).await?;

    // 3. 启动后台流任务
    let cancel_token = CancellationToken::new();
    state.active_streams.lock().await.insert(chat_id.clone(), cancel_token.clone());

    let ai = state.ai.clone();
    let db = state.db.clone();
    let app_handle = app.clone();
    let chat_id_clone = chat_id.clone();
    let assistant_id = assistant_msg.id.clone();

    tokio::spawn(async move {
        if let Err(e) = crate::ai::stream::run_stream(
            &app_handle,
            &ai,
            &db,
            &chat_id_clone,
            &assistant_id,
            cancel_token,
        ).await {
            crate::ai::events::emit_error(
                &app_handle,
                &chat_id_clone,
                &assistant_id,
                e,
            );
        }
    });

    Ok(SendMessageResult { user_message: user_msg })
}

#[derive(serde::Serialize)]
pub struct SendMessageResult {
    pub user_message: Message,
}
```

### 6.3 AI 控制命令（`src/commands/ai.rs`）

```rust
#[tauri::command]
pub async fn stop_generation(
    state: State<'_, AppState>,
    chat_id: String,
) -> AppResult<()> {
    if let Some(token) = state.active_streams.lock().await.remove(&chat_id) {
        token.cancel();
    }
    Ok(())
}
```

### 6.4 Favorite 命令（`src/commands/favorite.rs`）

```rust
#[tauri::command]
pub async fn create_favorite(
    state: State<'_, AppState>,
    title: String,
    content: String,
    source_chat_id: Option<String>,
) -> AppResult<Favorite> {
    crate::db::favorite::create(&state.db, title, content, source_chat_id).await
}

#[tauri::command]
pub async fn list_favorites(state: State<'_, AppState>) -> AppResult<Vec<Favorite>> {
    crate::db::favorite::list_all(&state.db).await
}

#[tauri::command]
pub async fn get_favorite(state: State<'_, AppState>, id: String) -> AppResult<Favorite> {
    crate::db::favorite::get(&state.db, &id).await
}

#[tauri::command]
pub async fn update_favorite(
    state: State<'_, AppState>,
    id: String,
    patch: FavoritePatch,
) -> AppResult<Favorite> {
    crate::db::favorite::update(&state.db, &id, patch).await
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoritePatch {
    pub title: Option<String>,
    pub content: Option<String>,
}

#[tauri::command]
pub async fn delete_favorite(state: State<'_, AppState>, id: String) -> AppResult<()> {
    crate::db::favorite::delete(&state.db, &id).await
}

#[tauri::command]
pub async fn count_favorites_by_chat(
    state: State<'_, AppState>,
    chat_id: String,
) -> AppResult<i64> {
    crate::db::favorite::count_by_chat(&state.db, &chat_id).await
}
```

### 6.5 Settings 命令（`src/commands/settings.rs`）

```rust
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> AppResult<Settings> {
    let api_key = crate::db::settings::get(&state.db, "deepseek_api_key")
        .await?
        .unwrap_or_default();
    Ok(Settings {
        has_api_key: !api_key.is_empty(),
        deepseek_api_key: api_key,    // 返回完整 key 给前端显示
    })
}

#[tauri::command]
pub async fn set_api_key(
    state: State<'_, AppState>,
    key: String,
) -> AppResult<Settings> {
    crate::db::settings::set(&state.db, "deepseek_api_key", &key).await?;
    get_settings(state).await
}
```

### 6.6 命令注册（`src/commands/mod.rs`）

```rust
mod chat;
mod message;
mod favorite;
mod settings;
mod ai;

pub use chat::*;
pub use message::*;
pub use favorite::*;
pub use settings::*;
pub use ai::*;
```

在 `lib.rs` 的 `invoke_handler!` 中按以下顺序注册（与前端调用顺序一致）：

```rust
.invoke_handler(tauri::generate_handler![
    // Chat
    commands::create_chat,
    commands::list_chats,
    commands::get_chat,
    commands::rename_chat,
    commands::delete_chat,
    // Message
    commands::list_messages,
    commands::send_message,
    // AI
    commands::stop_generation,
    // Favorite
    commands::create_favorite,
    commands::list_favorites,
    commands::get_favorite,
    commands::update_favorite,
    commands::delete_favorite,
    commands::count_favorites_by_chat,
    // Settings
    commands::get_settings,
    commands::set_api_key,
])
```

---

## 7. DeepSeek 集成

### 7.1 事件名 + Payload（`src/ai/events.rs`）

```rust
use serde::Serialize;

pub const AI_STREAM_START: &str = "ai-stream-start";
pub const AI_STREAM_CHUNK: &str = "ai-stream-chunk";
pub const AI_STREAM_END:   &str = "ai-stream-end";
pub const AI_STREAM_ERROR: &str = "ai-stream-error";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiStreamStart {
    pub chat_id: String,
    pub assistant_message_id: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiStreamChunk {
    pub chat_id: String,
    pub assistant_message_id: String,
    pub delta: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiStreamEnd {
    pub chat_id: String,
    pub assistant_message_id: String,
    pub full_content: String,
    pub stopped: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiStreamError {
    pub chat_id: String,
    pub assistant_message_id: String,
    pub error: AiErrorPayload,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiErrorPayload {
    #[serde(rename = "type")]
    pub kind: String,   // "network" | "model" | "timeout" | "unknown" | "api_key"
    pub message: String,
}

pub fn emit_chunk(app: &tauri::AppHandle, payload: &AiStreamChunk) {
    let _ = app.emit_all(AI_STREAM_CHUNK, payload);
}
pub fn emit_end(app: &tauri::AppHandle, payload: &AiStreamEnd) {
    let _ = app.emit_all(AI_STREAM_END, payload);
}
pub fn emit_error(app: &tauri::AppHandle, chat_id: &str, assistant_id: &str, err: AppError) {
    let payload = AiStreamError {
        chat_id: chat_id.to_string(),
        assistant_message_id: assistant_id.to_string(),
        error: AiErrorPayload {
            kind: classify_error(&err),
            message: err.to_string(),
        },
    };
    let _ = app.emit_all(AI_STREAM_ERROR, &payload);
}
```

> 事件名、payload 字段名必须与前端架构 §5 完全一致。

### 7.2 HTTP 客户端（`src/ai/client.rs`）

```rust
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::time::Duration;

const DEEPSEEK_API_URL: &str = "https://api.deepseek.com/v1/chat/completions";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

pub struct AiClient {
    http: reqwest::Client,
}

impl AiClient {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()
            .expect("reqwest client");
        Self { http }
    }

    pub async fn stream_chat(
        &self,
        api_key: &str,
        messages: &[ChatMessage],
        cancel: tokio_util::sync::CancellationToken,
    ) -> AppResult<tokio::sync::mpsc::Receiver<String>> {
        let request = ChatRequest {
            model: "deepseek-chat",
            messages,
            stream: true,
        };

        let resp = self.http.post(DEEPSEEK_API_URL)
            .bearer_auth(api_key)
            .json(&request)
            .send()
            .await
            .map_err(|e| match e.status() {
                Some(s) if s.as_u16() == 401 => AppError::Ai("api_key".into()),
                _ => AppError::Network(e),
            })?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Ai(format!("HTTP {}: {}", status, body)));
        }

        let (tx, rx) = tokio::sync::mpsc::channel::<String>(64);
        let mut stream = resp.bytes_stream();

        tokio::spawn(async move {
            let mut buffer = String::new();
            while let Some(chunk) = stream.next().await {
                if cancel.is_cancelled() { break; }
                let bytes = match chunk { Ok(b) => b, Err(_) => break };
                buffer.push_str(&String::from_utf8_lossy(&bytes));

                while let Some(idx) = buffer.find('\n') {
                    let line: String = buffer.drain(..=idx).collect();
                    let line = line.trim();
                    if let Some(data) = line.strip_prefix("data: ") {
                        if data == "[DONE]" { return; }
                        if let Ok(sse) = serde_json::from_str::<SseResponse>(data) {
                            if let Some(choice) = sse.choices.first() {
                                if let Some(delta) = &choice.delta.content {
                                    if tx.send(delta.clone()).await.is_err() { return; }
                                }
                            }
                        }
                    }
                }
            }
        });

        Ok(rx)
    }
}

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'static str,
    messages: &'a [ChatMessage],
    stream: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,   // "user" | "assistant" | "system"
    pub content: String,
}

#[derive(Deserialize)]
struct SseResponse {
    choices: Vec<SseChoice>,
}
#[derive(Deserialize)]
struct SseChoice {
    delta: SseDelta,
}
#[derive(Deserialize)]
struct SseDelta {
    content: Option<String>,
}
```

### 7.3 流式任务（`src/ai/stream.rs`）

```rust
use futures::StreamExt;
use tauri::AppHandle;
use tokio_util::sync::CancellationToken;

use crate::ai::client::AiClient;
use crate::ai::events::*;
use crate::db::DbPool;
use crate::error::AppResult;

pub async fn run_stream(
    app: &AppHandle,
    ai: &AiClient,
    db: &DbPool,
    chat_id: &str,
    assistant_message_id: &str,
    cancel: CancellationToken,
) -> AppResult<()> {
    // 1. 读取 API Key
    let api_key = crate::db::settings::get(db, "deepseek_api_key")
        .await?
        .ok_or_else(|| crate::error::AppError::Ai("api_key not set".into()))?;
    if api_key.is_empty() {
        return Err(crate::error::AppError::Ai("api_key empty".into()));
    }

    // 2. 读取该 chat 的历史 messages（构建上下文）
    let history = crate::db::message::list_by_chat(db, chat_id).await?;
    let context: Vec<_> = history.iter()
        .map(|m| crate::ai::client::ChatMessage {
            role: match m.role {
                crate::models::MessageRole::User => "user",
                crate::models::MessageRole::Assistant => "assistant",
                crate::models::MessageRole::System => "system",
            }.to_string(),
            content: m.content.clone(),
        })
        .collect();

    // 3. 发送 Start 事件
    emit_event(app, AI_STREAM_START, &AiStreamStart {
        chat_id: chat_id.to_string(),
        assistant_message_id: assistant_message_id.to_string(),
    });

    // 4. 开启 SSE 流
    let mut rx = ai.stream_chat(&api_key, &context, cancel.clone()).await?;
    let mut full_content = String::new();
    let mut stopped = false;

    // 5. 接收 chunks
    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                stopped = true;
                break;
            }
            chunk = rx.recv() => {
                match chunk {
                    Some(delta) => {
                        full_content.push_str(&delta);
                        emit_event(app, AI_STREAM_CHUNK, &AiStreamChunk {
                            chat_id: chat_id.to_string(),
                            assistant_message_id: assistant_message_id.to_string(),
                            delta,
                        });
                    }
                    None => break,    // 流结束
                }
            }
        }
    }

    // 6. 持久化完整内容
    crate::db::message::update_content(db, assistant_message_id, &full_content).await?;
    crate::db::chat::touch(db, chat_id).await?;    // 更新 chat 排序时间

    // 7. 发送 End 事件
    emit_event(app, AI_STREAM_END, &AiStreamEnd {
        chat_id: chat_id.to_string(),
        assistant_message_id: assistant_message_id.to_string(),
        full_content,
        stopped,
    });

    Ok(())
}

fn emit_event<T: Serialize + Clone>(app: &AppHandle, name: &str, payload: &T) {
    let _ = app.emit_all(name, payload);
}
```

> 注：`emit_all` 在 Tauri 2.x 中可换成 `app.emit_to("main", name, payload)` 按窗口发送。MVP 用全应用广播即可。

---

## 8. 错误处理

### 8.1 错误类型（`src/error.rs`）

```rust
use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("AI error: {0}")]
    Ai(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),
}

pub type AppResult<T> = Result<T, AppError>;

// Tauri 要求命令的 Result 类型必须可序列化
// 把错误转为 String 传给前端
impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}
```

### 8.2 错误分类

| AppError | 前端 `error.type` | 触发场景 |
|---|---|---|
| `AppError::Network` | `network` | reqwest 网络错误 |
| `AppError::Ai("api_key")` | `api_key` | DeepSeek 返回 401 |
| `AppError::Ai("...")` | `model` | DeepSeek 4xx/5xx |
| `AppError::Ai("timeout")` | `timeout` | 流超时 |
| `AppError::NotFound` | `unknown` | 资源不存在 |
| `AppError::Validation` | `validation` | 参数非法 |
| `AppError::Database` | `unknown` | DB 错误（不向前端暴露细节） |

`classify_error` 函数在 `ai/events.rs` 中实现。

### 8.3 错误暴露原则

- **不**向前端暴露 SQL 错误细节
- **不**暴露文件系统路径
- AI 错误可以暴露 DeepSeek 返回的 message（不含 key）
- 所有错误最终以**字符串**形式传前端，前端用 `inline-message` 展示

---

## 9. 编码规范

### 9.1 命名

| 类型 | 规则 | 示例 |
|---|---|---|
| 模块 | snake_case | `favorite.rs` |
| 函数 | snake_case | `create_favorite` |
| 变量 | snake_case | `chat_id` |
| 类型 | PascalCase | `AppState`, `Message` |
| 常量 | UPPER_SNAKE | `AI_STREAM_CHUNK` |
| 错误变体 | PascalCase | `AppError::NotFound` |

### 9.2 异步

- **全部**命令用 `async fn`
- **不要**在 `tokio::spawn` 中持有 `State` 引用（生命周期问题），改为 clone 必要的 Arc
- 用 `tokio::select!` 处理取消
- 长时间任务必须能取消（接收 `CancellationToken`）

### 9.3 数据库

- 所有 SQL 用 `sqlx::query` / `query_as`，**不**用 `query!` 宏（避免编译期 DB 依赖）
- 所有写操作完成后必须 commit（sqlx 自动）
- 涉及外键的表（`messages`、`favorites`）开启 PRAGMA `foreign_keys = ON`
- 长事务拆短

### 9.4 错误处理

- 内部使用 `anyhow::Result` 自由处理
- 对外（Tauri 命令、AI 事件）必须用 `AppResult<T>` / `AppError`
- **不**用 `unwrap()` / `expect()` 在生产代码路径；只在启动初始化等确实 panic 可接受处用
- **不**静默吞错；要么向上抛，要么 `tracing::error!` 记录

### 9.5 日志

```rust
use tracing::{info, warn, error};

// 命令入口
info!(chat_id = %chat_id, "create_chat called");

// 错误
error!(err = %e, "AI stream failed");
```

日志输出由 Tauri 的 `tracing-subscriber` 在 `lib.rs::run()` 开头初始化：

```rust
tracing_subscriber::fmt()
    .with_max_level(tracing::Level::INFO)
    .with_target(false)
    .init();
```

### 9.6 敏感字段

- `deepseek_api_key` **不**写入日志
- 任何错误 message **不**包含 API Key

### 9.7 ID 与时间

```rust
// ID（V1.1 改为 UUIDv7）
let id = uuid::Uuid::new_v7().to_string();

// 时间戳
let now = chrono::Utc::now().timestamp_millis();
```

**禁止**：
- 用 `String::new()` + 后续填充作为 ID（必须一次生成）
- 用 `SystemTime::now()` 然后再转换（直接用 chrono）
- 用本地时间（必须 UTC）
- **V1.1 新增**：使用 `Uuid::new_v4()`（已统一改为 v7）

---

## 10. 性能与可靠性底线

| 指标 | 目标 |
|---|---|
| 启动时间 | < 1.5s |
| 列表加载（< 1000 条） | < 100ms |
| 消息发送 → 首 token | < 2s |
| 流式 chunk 延迟 | < 200ms |
| SQLite 写入 | < 50ms |
| DB 连接池 | max_connections = 5 |

**关键实现点**：
- AI 流用 `tokio::sync::mpsc` 而**不**是 unbounded channel（防止 OOM）
- 消息列表按 `id`（UUIDv7）查，**不再**按 `created_at`（V1.1）
- Chat 列表按 `updated_at` 索引查
- Favorite 列表按 `updated_at` 索引查
- 取消生成必须在 **300ms 内**生效（用户感知不到延迟）

---

## 11. Cargo.toml 关键依赖

```toml
[package]
name = "little-ice"
version = "0.1.0"
edition = "2021"

[lib]
name = "little_ice_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
tokio-util = "0.7"
sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "sqlite", "macros", "migrate"] }
reqwest = { version = "0.12", features = ["json", "stream", "rustls-tls"] }
futures = "0.3"
uuid = { version = "1", features = ["v7"] }  # V1.1: UUIDv7
chrono = { version = "0.4", features = ["serde"] }
thiserror = "1"
anyhow = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
```

---

## 12. tauri.conf.json 关键配置

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Little Ice",
  "version": "0.1.0",
  "identifier": "com.littleice.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [{
      "title": "Little Ice",
      "width": 1200,
      "height": 800,
      "minWidth": 960,
      "minHeight": 600,
      "resizable": true
    }],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/icon.png"]
  }
}
```

---

## 13. capabilities/default.json

Tauri 2 权限声明：

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "默认权限",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default"
  ]
}
```

> MVP 不需要 fs / http / shell 等敏感权限。

---

## 14. 开发与构建

### 14.1 开发模式

```bash
# 在项目根目录
npm install
npm run tauri dev
```

### 14.2 生产构建

```bash
npm run tauri build
```

产物路径：
- macOS: `src-tauri/target/release/bundle/dmg/`
- Windows: `src-tauri/target/release/bundle/msi/`

### 14.3 数据库重置（开发期）

```bash
# 删除 db 文件，下次启动会自动重建
rm ~/Library/Application\ Support/com.littleice.app/little-ice.db
```

---

## 15. 测试策略（MVP 不强制）

| 级别 | 范围 | 工具 |
|---|---|---|
| 单元 | `db/*` CRUD | `#[sqlx::test]` 内存 SQLite |
| 集成 | `commands/*` | `tauri::test::mock_builder()` |
| 手动 | AI 流式端到端 | dev 模式 + 真实 API Key |

MVP 阶段只做手动测试，集成测试作为后续工作。

---

## 16. 如何使用本文档（给 VSCode LLM 用）

每次开启新的 AI 编码会话，**先发这段提示词**：

```text
你是 Little Ice 项目的 Rust + Tauri 2.x 后端工程师。
你必须严格遵守以下四份文档（按顺序阅读）：
1. docs/ux-specification.md          （产品 UX 规范）
2. docs/frontend-architecture.md     （前端架构，含前后端命令契约的源）
3. docs/backend-architecture.md      （本文档，后端实现约束）
4. docs/design-system.md             （设计系统，前端 UI 约束）

约束：
- 任何与本文档冲突的"行业最佳实践"以本文档为准
- 不在 MVP 范围内的功能直接拒绝实现，并提示需要先更新文档
- 不引入本文档禁止的库（见 §1）
- 修改 Tauri 命令签名需要先报告（因为前端依赖）
- 数据库 schema 变更需要写新的 migration 文件，不修改已有
- 写代码前先说你要改哪些文件、为什么
- 代码风格遵循 §9
```

随后将本次具体需求附上即可。

---

## 17. 版本

| 版本 | 日期 | 变更 |
|---|---|---|
| 1.0 | 2026-06-12 | 初版，对齐 UX Spec V5.5 / 前端架构 V1.3 / 设计系统 V1.4 |
| 1.1 | 2026-06-12 | **ID 改用 UUIDv7**（时间有序）：uuid crate features 改 `v7`；`Uuid::new_v4()` → `new_v7()`；messages 索引简化为 `idx_messages_chat_id`（不再需要 `created_at` 复合索引）；消息列表 `ORDER BY id`（替代 `created_at`）；`created_at` 字段保留用于显示 |
