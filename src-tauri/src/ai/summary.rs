//! 333 原则对话摘要服务
//!
//! 333 原则：
//! - 3 个最近摘要
//! - 3 轮最近对话
//! - 每 3 轮触发一次摘要生成
//!
//! 本模块在 `send_message` 用户提交问题后、AI 回复前被调用，
//! 透明地判断是否需要生成摘要，并将结果持久化到 `chat_summaries` 表。
//! 每个 chat 最多保留 3 条最新摘要（333 原则）。

use std::time::Duration;

use sqlx::types::Json;

use crate::ai::client::{AiClient, ChatMessage};
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{ChatSummary, Message, SummaryContext, UnixMs};

const SUMMARY_PROMPT: &str = "将以下对话压缩为后续对话上下文。\n\n要求：\n1. 保留主题、结论、未解决问题和关键约束\n2. 删除举例、解释过程和重复内容\n3. 使用最简洁的表达\n4. 摘要控制在300字以内\n5. 提取3-5个关键词\n6. 不要添加原文没有的信息\n\n对话：\n{conversation}\n\n输出格式：\n摘要：<摘要内容>\n关键词：<关键词1>、<关键词2>、<关键词3>";

const SUMMARY_TIMEOUT: Duration = Duration::from_secs(5);
const SUMMARY_MAX_LEN: usize = 300;
const FALLBACK_KEYWORDS: &[&str] = &["对话", "问题", "讨论"];

pub struct SummaryService;

impl SummaryService {
    /// 检查并执行摘要生成（用户提交问题后、AI 回复前调用）。
    ///
    /// `current_user_message_id` 为刚刚创建的当前 user 消息 id，
    /// 摘要收集范围严格在该消息之前。
    ///
    /// 返回生成的摘要（如果触发），否则返回 `None`。
    pub async fn maybe_summarize(
        db: &DbPool,
        ai: &AiClient,
        chat_id: &str,
        current_user_message_id: &str,
    ) -> AppResult<Option<ChatSummary>> {
        let current_round = crate::db::message::count_user_messages(db, chat_id).await?;
        let latest_summary = crate::db::summary::find_latest_by_chat(db, chat_id).await?;

        let should_trigger = match &latest_summary {
            Some(summary) => {
                let last_msg_seq = crate::db::message::count_user_messages_up_to_id(
                    db,
                    chat_id,
                    &summary.last_message_id,
                )
                .await?;
                current_round.saturating_sub(last_msg_seq) >= 3
            }
            None => current_round >= 4,
        };

        if !should_trigger {
            return Ok(None);
        }

        // 收集当前消息之前的最近 3 轮完整对话
        let recent_messages = crate::db::message::list_recent_complete_rounds_before(
            db,
            chat_id,
            current_user_message_id,
            3,
        )
        .await?;

        if recent_messages.len() < 2 {
            return Ok(None);
        }

        let summary_text = match Self::generate_summary(ai, db, &recent_messages).await {
            Ok(text) => text,
            Err(e) => {
                tracing::warn!(chat_id, error = %e, "summary generation failed, using fallback");
                Self::fallback_summarize(&recent_messages)
            }
        };

        let (content, keywords) = Self::parse_summary_response(&summary_text);

        let last_message_id = recent_messages
            .last()
            .map(|m| m.id.clone())
            .unwrap_or_else(|| current_user_message_id.to_string());

        let new_summary = ChatSummary {
            id: uuid::Uuid::new_v7(uuid::Timestamp::now(uuid::NoContext)).to_string(),
            chat_id: chat_id.to_string(),
            content,
            keywords: Json(keywords),
            last_message_id,
            created_at: UnixMs::now(),
        };

        crate::db::summary::replace_for_chat(db, chat_id, &new_summary).await?;
        Ok(Some(new_summary))
    }

    /// 获取某 chat 的当前摘要上下文。
    pub async fn get_context(db: &DbPool, chat_id: &str) -> AppResult<SummaryContext> {
        let latest = crate::db::summary::find_latest_by_chat(db, chat_id).await?;
        Ok(latest
            .map(|s| SummaryContext {
                summary: Some(s.content),
                keywords: Some(s.keywords.0),
                last_message_id: Some(s.last_message_id),
            })
            .unwrap_or_default())
    }

    async fn generate_summary(
        ai: &AiClient,
        db: &DbPool,
        messages: &[Message],
    ) -> AppResult<String> {
        let api_key = crate::db::settings::get(db, "deepseek_api_key")
            .await?
            .ok_or_else(|| AppError::Ai("api_key not set".into()))?;
        if api_key.is_empty() {
            return Err(AppError::Ai("api_key empty".into()));
        }

        let conversation = messages
            .iter()
            .map(|m| format!("{}: {}", m.role.as_protocol_str(), m.content))
            .collect::<Vec<_>>()
            .join("\n");

        let prompt = SUMMARY_PROMPT.replace("{conversation}", &conversation);
        let request_messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: "你是一位擅长对话摘要的助手。".to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: prompt,
            },
        ];

        let result =
            tokio::time::timeout(SUMMARY_TIMEOUT, ai.complete(&api_key, &request_messages)).await;

        match result {
            Ok(Ok(text)) => Ok(text),
            Ok(Err(e)) => Err(e),
            Err(_) => Err(AppError::SummaryTimeout),
        }
    }

    fn parse_summary_response(text: &str) -> (String, Vec<String>) {
        let mut content = String::new();
        let mut keywords = FALLBACK_KEYWORDS
            .iter()
            .map(|&k| k.to_string())
            .collect::<Vec<_>>();
        let mut found_keywords = false;

        for line in text.lines() {
            let line = line.trim();
            if let Some(c) = line.strip_prefix("摘要：") {
                content = c.trim().to_string();
            } else if let Some(k) = line.strip_prefix("关键词：") {
                let parsed: Vec<String> = k
                    .split(['、', ',', ' '])
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                if !parsed.is_empty() {
                    keywords = parsed;
                    found_keywords = true;
                }
            }
        }

        if !found_keywords && !content.is_empty() {
            // 有摘要内容但缺关键词时，保持默认关键词
        }

        if content.chars().count() > SUMMARY_MAX_LEN {
            content = Self::truncate_content(&content, SUMMARY_MAX_LEN);
        }

        (content, keywords)
    }

    fn fallback_summarize(messages: &[Message]) -> String {
        let conversation = messages
            .iter()
            .map(|m| format!("{}: {}", m.role.as_protocol_str(), m.content))
            .collect::<Vec<_>>()
            .join("\n");

        let content = if conversation.chars().count() > SUMMARY_MAX_LEN {
            Self::truncate_content(&conversation, SUMMARY_MAX_LEN)
        } else {
            conversation
        };

        format!(
            "摘要：{}\n关键词：{}",
            content,
            FALLBACK_KEYWORDS.join("、")
        )
    }

    fn truncate_content(s: &str, max_chars: usize) -> String {
        if s.chars().count() <= max_chars {
            return s.to_string();
        }
        let head_len = max_chars / 2;
        let tail_len = max_chars.saturating_sub(head_len).saturating_sub(3);
        let chars: Vec<char> = s.chars().collect();
        let head: String = chars.iter().take(head_len).collect();
        let tail: String = chars
            .iter()
            .skip(chars.len().saturating_sub(tail_len))
            .collect();
        format!("{}...{}", head, tail)
    }
}
