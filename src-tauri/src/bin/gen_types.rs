//! TypeScript 类型生成器（specta v2）
//!
//! 用法：在 `src-tauri/` 下跑
//! ```bash
//! cargo run --bin gen_types
//! ```
//! 会把生成的 TypeScript 类型写到 `<project-root>/src/types/generated.ts`。
//!
//! ## 与 tauri-specta 的区别
//!
//! 本生成器只导出**类型**（不导出命令签名），覆盖范围：
//!
//! - `models::*` — Chat / Message / MessageRole / Favorite / Settings
//! - `commands::message::SendMessageResult`
//! - `db::favorite::FavoritePatch`（update_favorite 的 patch 入参）
//!
//! 注：命令返回的错误统一是 `string`（`AppError` 实现了 `Serialize as String`），
//! 前端不需要独立类型，直接用 `try/catch` 捕获 string 即可。
//!
//! 后续如需导出**命令签名 + 类型安全的 invoke 包装**（tauri-specta 风格），
//! 改用 `tauri_specta::Builder::new().commands(collect_commands![...])`。

use std::path::PathBuf;

use little_ice_lib::commands::message::SendMessageResult;
use little_ice_lib::db::favorite::FavoritePatch;
use little_ice_lib::models::{Chat, Favorite, Message, MessageRole, Role, Settings};

use specta::Types;
use specta_serde::Format;
use specta_typescript::Typescript;

/// `CARGO_MANIFEST_DIR` = `src-tauri/` 目录
fn output_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent() // → 项目根目录
        .expect("project root")
        .join("src")
        .join("types")
        .join("generated.ts")
}

fn main() {
    // `Types::register` 是 builder 风格（消费 self）→ 用链式
    let types = Types::default()
        // 数据模型（与前端 §3 对齐）
        .register::<Chat>()
        .register::<Message>()
        .register::<MessageRole>()
        .register::<Favorite>()
        .register::<Role>()
        .register::<Settings>()
        // 命令相关 DTO
        .register::<SendMessageResult>()
        .register::<FavoritePatch>();

    // 输出到文件
    let out = output_path();
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent).expect("create parent dir");
    }
    Typescript::default()
        .export_to(&out, &types, Format)
        .expect("failed to render TypeScript");

    println!("✓ Generated: {}", out.display());
}
