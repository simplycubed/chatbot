export interface ChatReplyFrame {
  ticketId: string;
  reply: string;
  escalated?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fromRecord(value: unknown): ChatReplyFrame | null {
  if (!isRecord(value)) return null;
  if (typeof value.reply !== "string" || typeof value.ticketId !== "string") return null;
  if (!value.reply || !value.ticketId) return null;
  return {
    ticketId: value.ticketId,
    reply: value.reply,
    escalated: value.escalated === true,
  };
}

/**
 * Read the one `event: reply` frame, or a bare JSON object with the same fields.
 * Returns null when the body is not that shape. The reply string is data.
 */
export function parseReplyFrame(body: string): ChatReplyFrame | null {
  const marker = "event: reply";
  const at = body.indexOf(marker);
  if (at !== -1) {
    const after = body.slice(at + marker.length);
    const dataLine = after
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("data:"));
    if (!dataLine) return null;
    try {
      return fromRecord(JSON.parse(dataLine.slice("data:".length).trim()));
    } catch {
      return null;
    }
  }
  try {
    return fromRecord(JSON.parse(body));
  } catch {
    return null;
  }
}
