//! 数据结构（与前端 §3 对齐）
//!
//! Rust 用 snake_case，serde 自动转为 JSON camelCase（前端期望的命名）。

mod chat;
mod favorite;
mod message;
mod role;
mod settings;
mod timestamp;

pub use chat::Chat;
pub use favorite::Favorite;
pub use message::{Message, MessageRole};
pub use role::Role;
pub use settings::Settings;
pub use timestamp::UnixMs;
