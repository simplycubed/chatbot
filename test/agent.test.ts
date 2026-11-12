import { describe, expect, it } from "vitest";
import { runChatAgent, type ChatComplete } from "../src/agent.js";
import { StructuredParseError } from "../src/errors.js";

const input = {
  instructions: "Speak plainly.",
  actor: { kind: "user" as const, id: "user-1" },
  question: "What is my plan?",
  topics: ["billing", "other"],
  residualTopic: "other",
};

const answer = {
  reply: "It is active.",
  confidence: "high",
  topic_category: "billing",
  outcome: "answered",
  escalate: false,
};

const noWait = () => 0;

function okComplete(
  text: string,
  usage?: { inputTokens: number; outputTokens: number },
): ChatComplete {
  return async (call) => {
    expect(call.messages[0]?.role).toBe("system");
    expect(call.temperature).toBe(0.2);
    expect(call.maxOutputTokens).toBe(1024);
    expect(call.signal).toBeInstanceOf(AbortSignal);
    return { text, usage };
  };
}

describe("runChatAgent", () => {
  it("returns a valid answer on the first attempt", async () => {
    const result = await runChatAgent(input, {
      complete: okComplete(JSON.stringify(answer), { inputTokens: 3, outputTokens: 4 }),
      backoffMs: noWait,
    });
    expect(result.attempts).toBe(1);
    expect(result.answer.reply).toBe("It is active.");
    expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 4 });
  });

  it("defaults missing usage to an empty object", async () => {
    const result = await runChatAgent(input, {
      complete: okComplete(JSON.stringify(answer)),
      backoffMs: noWait,
    });
    expect(result.usage).toEqual({});
  });

  it("retries once after a schema failure and then succeeds", async () => {
    let calls = 0;
    const result = await runChatAgent(input, {
      complete: async () => {
        calls += 1;
        return {
          text: calls === 1 ? JSON.stringify({ ...answer, reply: "" }) : JSON.stringify(answer),
        };
      },
      backoffMs: noWait,
    });
    expect(calls).toBe(2);
    expect(result.attempts).toBe(2);
  });

  it("throws a reason code and not the model text when both attempts are garbage", async () => {
    const secret = "model said do not store this sentence";
    await expect(
      runChatAgent(input, {
        complete: async () => ({ text: secret }),
        backoffMs: noWait,
      }),
    ).rejects.toMatchObject({
      name: "StructuredParseError",
      reason: "non_json",
      attempts: 2,
      transient: false,
    });
    try {
      await runChatAgent(input, { complete: async () => ({ text: secret }), backoffMs: noWait });
    } catch (err) {
      expect(err).toBeInstanceOf(StructuredParseError);
      expect((err as Error).message).not.toContain(secret);
      expect((err as Error).message).toContain("non_json");
    }
  });

  it("classifies a JSON object that fails the schema", async () => {
    await expect(
      runChatAgent(input, {
        complete: async () => ({ text: JSON.stringify({ ...answer, topic_category: "nope" }) }),
        backoffMs: noWait,
      }),
    ).rejects.toMatchObject({ reason: "schema_invalid", transient: false });
  });

  it("classifies a transport throw as transient", async () => {
    await expect(
      runChatAgent(input, {
        complete: async () => {
          throw new Error("upstream down");
        },
        backoffMs: noWait,
      }),
    ).rejects.toMatchObject({ reason: "transport", transient: true });
  });

  it("classifies a timeout and does not keep the hanging call's text", async () => {
    await expect(
      runChatAgent(input, {
        complete: () => new Promise(() => {}),
        timeoutMs: 15,
        backoffMs: noWait,
      }),
    ).rejects.toMatchObject({ reason: "timeout", transient: true });
  });

  it("treats an abort inside the model call as a timeout", async () => {
    await expect(
      runChatAgent(input, {
        complete: (call) =>
          new Promise((_, reject) => {
            call.signal.addEventListener("abort", () => reject(new Error("aborted")));
          }),
        timeoutMs: 15,
        backoffMs: noWait,
      }),
    ).rejects.toMatchObject({ reason: "timeout" });
  });

  it("uses the default retry delay when the host does not override it", async () => {
    let calls = 0;
    const started = Date.now();
    await runChatAgent(input, {
      complete: async () => {
        calls += 1;
        return {
          text: calls === 1 ? "nope" : JSON.stringify(answer),
        };
      },
    });
    expect(calls).toBe(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(150);
  });

  it("honors a host temperature and token cap", async () => {
    await runChatAgent(input, {
      complete: async (call) => {
        expect(call.temperature).toBe(0);
        expect(call.maxOutputTokens).toBe(32);
        return { text: JSON.stringify(answer) };
      },
      temperature: 0,
      maxOutputTokens: 32,
      backoffMs: noWait,
    });
  });
});
