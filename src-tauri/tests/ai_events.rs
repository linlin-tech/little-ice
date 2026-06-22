//! 集成测试：AI 事件契约 + 错误分类
//!
//! 不依赖 Tauri runtime；只测纯函数（事件名 / payload 序列化 / classify_error）。

use little_ice_lib::ai::events::{
    AI_STREAM_CHUNK, AI_STREAM_END, AI_STREAM_ERROR, AI_STREAM_START, classify_error,
};
use little_ice_lib::ai::events::{AiErrorPayload, AiStreamChunk, AiStreamEnd, AiStreamError};
use little_ice_lib::error::AppError;
use serde_json::json;

// ===== 事件名与前端 §5 一致 =====

#[test]
fn event_names_match_frontend_contract() {
    assert_eq!(AI_STREAM_START, "ai-stream-start");
    assert_eq!(AI_STREAM_CHUNK, "ai-stream-chunk");
    assert_eq!(AI_STREAM_END, "ai-stream-end");
    assert_eq!(AI_STREAM_ERROR, "ai-stream-error");
}

// ===== Payload camelCase 序列化（前端期望的字段名）=====

#[test]
fn ai_stream_end_serializes_with_camel_case() {
    let p = AiStreamEnd {
        chat_id: "c1".into(),
        assistant_message_id: "m1".into(),
        full_content: "hello".into(),
        stopped: false,
    };
    let j = serde_json::to_value(&p).unwrap();
    assert_eq!(j["chatId"], "c1");
    assert_eq!(j["assistantMessageId"], "m1");
    assert_eq!(j["fullContent"], "hello");
    assert_eq!(j["stopped"], false);
    // 确认没有 snake_case 字段泄漏
    assert!(j.get("chat_id").is_none());
    assert!(j.get("assistant_message_id").is_none());
    assert!(j.get("full_content").is_none());
}

#[test]
fn ai_stream_end_stopped_true_on_user_cancel() {
    let p = AiStreamEnd {
        chat_id: "c".into(),
        assistant_message_id: "m".into(),
        full_content: "partial...".into(),
        stopped: true,
    };
    let j = serde_json::to_value(&p).unwrap();
    assert_eq!(j["stopped"], true);
}

#[test]
fn ai_stream_chunk_serializes_with_camel_case() {
    let p = AiStreamChunk {
        chat_id: "c".into(),
        assistant_message_id: "m".into(),
        delta: "chunk".into(),
    };
    let j = serde_json::to_value(&p).unwrap();
    assert_eq!(j["chatId"], "c");
    assert_eq!(j["assistantMessageId"], "m");
    assert_eq!(j["delta"], "chunk");
    assert!(j.get("assistant_message_id").is_none());
}

#[test]
fn ai_stream_error_serializes_with_camel_case_and_type_field() {
    // 模拟 emit_error 内部构造 payload
    let p = AiStreamError {
        chat_id: "c".into(),
        assistant_message_id: "m".into(),
        error: AiErrorPayload {
            kind: "api_key".into(),
            message: "invalid api key".into(),
        },
    };
    let j = serde_json::to_value(&p).unwrap();
    assert_eq!(j["chatId"], "c");
    assert_eq!(j["assistantMessageId"], "m");
    assert_eq!(j["error"]["type"], "api_key");
    assert_eq!(j["error"]["message"], "invalid api key");
    // `type` 字段名是保留字，必须用 `#[serde(rename = "type")]`
    assert!(j["error"].get("kind").is_none());
}

// ===== 错误分类（§7.1 / §8.2）=====

#[tokio::test]
async fn classify_error_network() {
    // 真的发请求到不存在的 host，触发网络错误
    let client = reqwest::Client::new();
    let req = client
        .get("http://this-domain-should-not-exist-12345.invalid")
        .build()
        .unwrap();
    let res = client.execute(req).await;
    // 一定失败（DNS 解析失败 / 连接错误）
    let err = res.expect_err("expected network error");
    let app_err = AppError::Network(err);
    assert_eq!(classify_error(&app_err), "network");
}

#[test]
fn classify_error_api_key_specific_literal() {
    // ai::client 在收到 401 时构造 `AppError::Ai("api_key".into())`
    let err = AppError::Ai("api_key".into());
    assert_eq!(classify_error(&err), "api_key");
}

#[test]
fn classify_error_timeout_specific_literal() {
    let err = AppError::Ai("timeout".into());
    assert_eq!(classify_error(&err), "timeout");
}

#[test]
fn classify_error_model_for_other_ai_messages() {
    let err = AppError::Ai("HTTP 502: bad gateway".into());
    assert_eq!(classify_error(&err), "model");

    let err = AppError::Ai("rate limit".into());
    assert_eq!(classify_error(&err), "model");
}

#[test]
fn classify_error_validation() {
    let err = AppError::Validation("title empty".into());
    assert_eq!(classify_error(&err), "validation");
}

#[test]
fn classify_error_not_found_is_unknown() {
    let err = AppError::NotFound("chat:xxx".into());
    assert_eq!(classify_error(&err), "unknown");
}

// ===== 序列化辅助：检查 AiErrorPayload JSON 结构匹配前端监听端期望 =====

#[test]
fn ai_error_payload_has_type_field_not_kind() {
    // 前端 TS:
    //   interface AiStreamError {
    //     chatId: Id;
    //     assistantMessageId: Id;
    //     error: { type: 'network' | 'model' | 'timeout' | 'unknown' | 'api_key'; message: string };
    //   }
    let p = AiErrorPayload {
        kind: "model".into(),
        message: "x".into(),
    };
    let j = serde_json::to_value(&p).unwrap();
    let expected = json!({ "type": "model", "message": "x" });
    assert_eq!(j, expected);
}
