//! DeepSeek HTTP 客户端
//!
//! 极简实现：直接用 `reqwest::bytes_stream` + 手写 SSE 解析。
//! 每个 `delta` 通过 `mpsc::channel` 推给上层消费者。

use std::time::Duration;

use futures::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::error::{AppError, AppResult};

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

    /// 发起流式 chat completion。返回的 receiver 收到的每个字符串是一个增量 `delta`。
    pub async fn stream_chat(
        &self,
        api_key: &str,
        messages: &[ChatMessage],
        cancel: CancellationToken,
    ) -> AppResult<mpsc::Receiver<String>> {
        let request = ChatRequest {
            model: "deepseek-chat",
            messages,
            stream: true,
        };

        let resp = self
            .http
            .post(DEEPSEEK_API_URL)
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

        let (tx, rx) = mpsc::channel::<String>(64);
        let mut stream = resp.bytes_stream();

        tokio::spawn(async move {
            let mut buffer = String::new();
            while let Some(chunk) = stream.next().await {
                if cancel.is_cancelled() {
                    break;
                }
                let bytes = match chunk {
                    Ok(b) => b,
                    Err(_) => break,
                };
                buffer.push_str(&String::from_utf8_lossy(&bytes));

                // 逐行解析 SSE（`\n` 分隔）
                while let Some(idx) = buffer.find('\n') {
                    let line: String = buffer.drain(..=idx).collect();
                    let line = line.trim();
                    if let Some(data) = line.strip_prefix("data: ") {
                        if data == "[DONE]" {
                            return;
                        }
                        if let Ok(sse) = serde_json::from_str::<SseResponse>(data) {
                            if let Some(choice) = sse.choices.first() {
                                if let Some(delta) = &choice.delta.content {
                                    if tx.send(delta.clone()).await.is_err() {
                                        return;
                                    }
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
    /// "user" | "assistant" | "system"
    pub role: String,
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
