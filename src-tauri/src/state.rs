//! 应用全局状态

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
