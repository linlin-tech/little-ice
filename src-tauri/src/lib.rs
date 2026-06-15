//! Little Ice · Tauri 2.x 后端
//!
//! 应用启动入口。`run()` 是 Tauri 2.x 的 `mobile_entry_point`（见 `#[cfg_attr]`）。
//!
//! 本文件包含：
//! - 模块导出
//! - Tauri Builder 配置
//! - 全部命令的 `invoke_handler!` 注册

use std::collections::HashMap;
use std::sync::Arc;

use tauri::Manager;
use tokio::sync::Mutex;

pub mod ai;
pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod state;

use crate::ai::AiClient;
use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_tracing();

    tauri::Builder::default()
        .setup(|app| {
            // 窗口打开时默认最大化
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.maximize();
            }

            // 1. 初始化 SQLite 连接池 + 运行迁移
            let db = tauri::async_runtime::block_on(crate::db::pool::init(app))?;

            // 2. 初始化 AI 客户端
            let ai = Arc::new(AiClient::new());

            // 3. 构造并注册全局状态
            app.manage(AppState {
                db,
                ai,
                active_streams: Mutex::new(HashMap::new()),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ===== Chat（§4.1）=====
            crate::commands::chat::create_chat,
            crate::commands::chat::list_chats,
            crate::commands::chat::get_chat,
            crate::commands::chat::rename_chat,
            crate::commands::chat::delete_chat,
            // ===== Message（§4.2）=====
            crate::commands::message::list_messages,
            crate::commands::message::send_message,
            // ===== AI 控制（§4.3）=====
            crate::commands::ai::stop_generation,
            // ===== Favorite（§4.4）=====
            crate::commands::favorite::create_favorite,
            crate::commands::favorite::list_favorites,
            crate::commands::favorite::get_favorite,
            crate::commands::favorite::get_favorite_by_message_id,
            crate::commands::favorite::update_favorite,
            crate::commands::favorite::delete_favorite,
            crate::commands::favorite::count_favorites_by_chat,
            // ===== Settings（§4.5）=====
            crate::commands::settings::get_settings,
            crate::commands::settings::set_api_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn init_tracing() {
    use tracing_subscriber::{fmt, EnvFilter};

    let _ = fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .try_init();
}
