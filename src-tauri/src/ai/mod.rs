//! DeepSeek 集成
//!
//! - `client`：HTTP 客户端（流式 chat completion）
//! - `stream`：SSE 解析 + 事件 emit + DB 持久化
//! - `events`：事件名常量 + payload 类型

pub mod client;
pub mod events;
pub mod stream;
pub mod summary;

pub use client::AiClient;
pub use summary::SummaryService;
