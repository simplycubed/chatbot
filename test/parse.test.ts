import { describe, expect, it } from "vitest";
import { extractJsonText, parseChatAnswer } from "../src/parse.js";

const topics = ["billing", "other"];

const good = {
  reply: "Your plan is active.",
  confidence: "high",
  topic_category: "billing",
  outcome: "answered",
  escalate: false,
};

describe("extractJsonText", () => {
  it("returns the outer object and leaves a non-object alone", () => {
    expect(extractJsonText('note {"a":1} tail')).toBe('{"a":1}');
    expect(extractJsonText("no object")).toBe("no object");
  });
});

describe("parseChatAnswer", () => {
  it("accepts a fenced object and an optional escalate reason", () => {
    const parsed = parseChatAnswer(
      "```\n" +
        JSON.stringify({ ...good, escalate: true, escalate_reason: "customer_requested" }) +
        "\n```",
      topics,
    );
    expect(parsed.ok && parsed.value.escalate_reason).toBe("customer_requested");
    expect(parsed.ok && parsed.value.reply).toBe("Your plan is active.");
  });

  it.each([
    ["not json", "hello"],
    ["array", "[]"],
    ["extra key", JSON.stringify({ ...good, tool: "send" })],
    ["empty reply", JSON.stringify({ ...good, reply: "  " })],
    ["bad confidence", JSON.stringify({ ...good, confidence: "sure" })],
    ["unknown topic", JSON.stringify({ ...good, topic_category: "shipping" })],
    ["bad outcome", JSON.stringify({ ...good, outcome: "guessed" })],
    ["escalate not boolean", JSON.stringify({ ...good, escalate: "yes" })],
    ["bad reason", JSON.stringify({ ...good, escalate_reason: "bored" })],
    ["non-string reply", JSON.stringify({ ...good, reply: 1 })],
  ])("rejects %s", (_label, raw) => {
    expect(parseChatAnswer(raw, topics)).toEqual({ ok: false });
  });

  it("omits a missing escalate reason", () => {
    const parsed = parseChatAnswer(JSON.stringify(good), topics);
    expect(parsed.ok && parsed.value.escalate_reason).toBeUndefined();
  });
});
