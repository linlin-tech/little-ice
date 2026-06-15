use serde::{Deserialize, Serialize};
use specta::Type;

/// Settings（前端 Settings，对应 §3 数据模型）
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub deepseek_api_key: String,
    /// 由 `deepseek_api_key` 非空派生，前端便捷字段
    pub has_api_key: bool,
}
