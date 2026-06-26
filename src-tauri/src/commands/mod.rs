//! Tauri 命令模块导出
//!
//! 子模块为命令实现文件；命令注册在 `lib.rs::run()` 的 `invoke_handler!` 中。
//!
//! 注：Tauri 2.x 的 `generate_handler!` 宏只接受**直接路径**到 `#[tauri::command]` 函数，
//! 不接受 `pub use` 重导出，所以本文件只 `pub mod` 暴露子模块，不做 re-export。

pub mod ai;
pub mod chat;
pub mod favorite;
pub mod message;
pub mod role;
pub mod settings;
pub mod tree_node;
