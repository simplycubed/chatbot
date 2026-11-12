export const CONFIDENCE = ["high", "medium", "low"] as const;
export const OUTCOMES = ["answered", "could_not_help"] as const;
export const ESCALATE_REASONS = [
  "low_confidence",
  "customer_requested",
  "no_grounding",
  "repeated_failure",
] as const;

export interface ChatAnswer {
  reply: string;
  confidence: (typeof CONFIDENCE)[number];
  topic_category: string;
  outcome: (typeof OUTCOMES)[number];
  escalate: boolean;
  escalate_reason?: (typeof ESCALATE_REASONS)[number];
}

const ANSWER_KEYS = [
  "reply",
  "confidence",
  "topic_category",
  "outcome",
  "escalate",
  "escalate_reason",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inList<T extends string>(value: unknown, list: readonly T[]): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/** Pull the outermost JSON object out of a fenced model response. */
export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

/**
 * Strict answer check. Extra keys fail. An empty reply fails. A topic outside
 * the host's list fails. The model text is not returned on failure.
 */
export function parseChatAnswer(
  raw: string,
  topics: readonly string[],
): { ok: true; value: ChatAnswer } | { ok: false } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(raw));
  } catch {
    return { ok: false };
  }
  if (!isRecord(parsed)) return { ok: false };
  for (const key of Object.keys(parsed)) {
    if (!(ANSWER_KEYS as readonly string[]).includes(key)) return { ok: false };
  }
  const reply = parsed.reply;
  const topic = parsed.topic_category;
  if (typeof reply !== "string" || reply.trim() === "") return { ok: false };
  if (!inList(parsed.confidence, CONFIDENCE)) return { ok: false };
  if (typeof topic !== "string" || !topics.includes(topic)) return { ok: false };
  if (!inList(parsed.outcome, OUTCOMES)) return { ok: false };
  if (typeof parsed.escalate !== "boolean") return { ok: false };
  const value: ChatAnswer = {
    reply: reply.trim(),
    confidence: parsed.confidence,
    topic_category: topic,
    outcome: parsed.outcome,
    escalate: parsed.escalate,
  };
  if ("escalate_reason" in parsed && parsed.escalate_reason !== undefined) {
    if (!inList(parsed.escalate_reason, ESCALATE_REASONS)) return { ok: false };
    value.escalate_reason = parsed.escalate_reason;
  }
  return { ok: true, value };
}
