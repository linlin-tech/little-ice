//! 时间戳 newtype：Unix 毫秒
//!
//! ## 三重身份
//!
//! 1. **serde**：`#[serde(transparent)]` → 序列化为 `number`（与前端 §3 `Timestamp` 一致）
//! 2. **sqlx**：`#[sqlx(transparent)]` → 读写 SQLite INTEGER 列零成本
//! 3. **specta**：手写 `Type` 实现，把内部 `i64` 渲染为 TypeScript `number`
//!    （通过 `specta_typescript::define("number")` 绕过 specta v2 对 `i64` 的 BigInt 拒绝）。
//!
//! ## 为什么不用 `chrono::DateTime<Utc>`？
//!
//! 前端架构 §3 明确 `Timestamp = number`（Unix 毫秒），保持数值与后端一致
//! 可省去前后端日期解析。Unix 毫秒在 2^53 范围内（约公元 287396 年）
//! 不会触发 JS `number` 精度问题。

use std::fmt;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use specta::datatype::{DataType, Reference};
use specta::{Type, Types};
use specta_typescript::define as ts_define;

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, sqlx::Type,
)]
#[serde(transparent)]
#[sqlx(transparent)]
pub struct UnixMs(pub i64);

impl UnixMs {
    pub fn now() -> Self {
        Self(chrono::Utc::now().timestamp_millis())
    }
}

impl From<i64> for UnixMs {
    fn from(v: i64) -> Self {
        Self(v)
    }
}

impl From<UnixMs> for i64 {
    fn from(v: UnixMs) -> Self {
        v.0
    }
}

impl fmt::Display for UnixMs {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// 懒初始化的 opaque reference：把 `UnixMs` 在 TypeScript 端渲染为字面量 `"number"`。
///
/// 绕开 specta-typescript 对裸 `i64` / `u64` / `i128` 等 BigInt 风格的
/// `BigIntForbidden` 检查（这些类型在 JS `number` 中可能丢精度）。
/// 我们的时间戳 < 2^53（约公元 287396 年），所以可以安全地强制渲染为 `number`。
fn unix_ms_ref() -> &'static Reference {
    static CACHE: OnceLock<Reference> = OnceLock::new();
    CACHE.get_or_init(|| ts_define("number"))
}

impl Type for UnixMs {
    fn definition(_types: &mut Types) -> DataType {
        DataType::Reference(unix_ms_ref().clone())
    }
}
