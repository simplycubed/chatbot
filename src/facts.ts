import type { ChatTurnResult } from "./turn.js";

const ALLOWED = [
  "ticket_id",
  "new_ticket",
  "message_chars",
  "char_bucket",
  "prior_customer_messages",
  "prior_agent_messages",
  "reference_count",
  "attempts",
  "input_tokens",
  "output_tokens",
  "outcome",
  "escalated",
  "degraded",
  "topic_category",
  "confidence",
  "escalate_reason",
] as const;

export type ChatFactKey = (typeof ALLOWED)[number];
export type ChatFactValue = string | number | boolean;

export function charBucket(length: number): "1-80" | "81-400" | "401-2000" | "2001+" {
  if (length <= 80) return "1-80";
  if (length <= 400) return "81-400";
  if (length <= 2000) return "401-2000";
  return "2001+";
}

/**
 * Closed property map for a turn. Message text, prompts, and model names are
 * not keys, and unknown keys passed by a caller are dropped.
 */
export function chatAnalyticsProperties(
  result: ChatTurnResult,
  extra?: Record<string, unknown>,
): Record<ChatFactKey, ChatFactValue> {
  const properties: Record<ChatFactKey, ChatFactValue> = {
    ticket_id: result.ticketId,
    new_ticket: result.newTicket,
    message_chars: result.messageChars,
    char_bucket: charBucket(result.messageChars),
    prior_customer_messages: result.priorCustomerMessages,
    prior_agent_messages: result.priorAgentMessages,
    reference_count: result.referenceCount,
    attempts: result.attempts,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    outcome: result.outcome,
    escalated: result.escalated,
    degraded: result.degraded,
    topic_category: result.topicCategory,
    confidence: result.confidence,
    escalate_reason: result.escalateReason ?? "",
  };
  if (extra) {
    for (const key of ALLOWED) {
      if (key in extra && isFact(extra[key])) properties[key] = extra[key];
    }
  }
  return properties;
}

function isFact(value: unknown): value is ChatFactValue {
  const kind = typeof value;
  return kind === "string" || kind === "number" || kind === "boolean";
}
