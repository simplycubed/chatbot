import { describe, expect, it } from "vitest";
import { charBucket, chatAnalyticsProperties } from "../src/facts.js";
import type { ChatTurnResult } from "../src/turn.js";

function result(over: Partial<ChatTurnResult> = {}): ChatTurnResult {
  return {
    ticketId: "t1",
    reply: "secret reply",
    topicCategory: "other",
    confidence: "low",
    escalated: false,
    degraded: false,
    newTicket: true,
    messageChars: 12,
    priorCustomerMessages: 0,
    priorAgentMessages: 0,
    referenceCount: 0,
    attempts: 1,
    inputTokens: 1,
    outputTokens: 2,
    outcome: "answered",
    ...over,
  };
}

describe("charBucket", () => {
  it.each([
    [1, "1-80"],
    [80, "1-80"],
    [81, "81-400"],
    [400, "81-400"],
    [401, "401-2000"],
    [2000, "401-2000"],
    [2001, "2001+"],
  ] as const)("%i chars is %s", (length, bucket) => {
    expect(charBucket(length)).toBe(bucket);
  });
});

describe("chatAnalyticsProperties", () => {
  it("keeps the closed set and drops message text", () => {
    const props = chatAnalyticsProperties(result(), {
      reply: "nope",
      prompt: "nope",
      body: "nope",
      model: "nope",
      ticket_id: "t-override",
      attempts: "2",
      escalated: false,
      extra: { nested: true },
    });
    expect(props.ticket_id).toBe("t-override");
    expect(props.attempts).toBe("2");
    expect(props.escalate_reason).toBe("");
    expect(JSON.stringify(props)).not.toContain("secret");
    expect(JSON.stringify(props)).not.toContain("nope");
    expect(props.char_bucket).toBe("1-80");
  });

  it("keeps an escalate reason and ignores a non-fact override", () => {
    const props = chatAnalyticsProperties(result({ escalateReason: "repeated_failure" }), {
      outcome: { bad: true },
    });
    expect(props.escalate_reason).toBe("repeated_failure");
    expect(props.outcome).toBe("answered");
  });
});
