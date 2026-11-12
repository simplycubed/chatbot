import type { ChatActor } from "./actor.js";
import { StructuredParseError, type ChatFailureReason } from "./errors.js";
import { parseChatAnswer, type ChatAnswer } from "./parse.js";
import { buildChatMessages, type ChatHistoryTurn, type ChatReference } from "./prompt.js";

export interface ChatUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface ChatCompletion {
  text: string;
  usage?: ChatUsage;
}

/** The host's model call. This package never builds a gateway client of its own. */
export interface ChatCompleteInput {
  messages: { role: "system" | "user"; content: string }[];
  temperature: number;
  maxOutputTokens: number;
  signal: AbortSignal;
}

export type ChatComplete = (input: ChatCompleteInput) => Promise<ChatCompletion>;

export interface RunChatAgentInput {
  instructions: string;
  actor: ChatActor;
  grounding?: string;
  references?: ChatReference[];
  history?: ChatHistoryTurn[];
  question: string;
  topics: readonly string[];
  residualTopic: string;
}

export interface RunChatAgentOptions {
  complete: ChatComplete;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** Delay before the single retry. Tests pass a zero delay. */
  backoffMs?: (random: () => number) => number;
}

export interface ChatAgentResult {
  answer: ChatAnswer;
  usage: ChatUsage;
  attempts: number;
}

const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
const DEFAULT_TIMEOUT_MS = 12_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultBackoff(random: () => number): number {
  return 200 + random() * 300;
}

class AttemptTimeoutError extends Error {
  constructor() {
    super("timeout");
    this.name = "AttemptTimeoutError";
  }
}

async function oneAttempt(
  complete: ChatComplete,
  messages: { role: "system" | "user"; content: string }[],
  temperature: number,
  maxOutputTokens: number,
  timeoutMs: number,
): Promise<ChatCompletion> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const timed = new Promise<never>((_, reject) => {
    ac.signal.addEventListener("abort", () => reject(new AttemptTimeoutError()), { once: true });
  });
  try {
    return await Promise.race([
      complete({ messages, temperature, maxOutputTokens, signal: ac.signal }).then(
        (value) => value,
        (err: unknown) => {
          if (ac.signal.aborted) throw new AttemptTimeoutError();
          throw err;
        },
      ),
      timed,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One structured model turn. Retries once, then throws. The thrown error names
 * a reason code and never the model text. There is no tool channel.
 */
export async function runChatAgent(
  input: RunChatAgentInput,
  options: RunChatAgentOptions,
  random: () => number = Math.random,
): Promise<ChatAgentResult> {
  const messages = buildChatMessages(input);
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const maxOutputTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const backoff = options.backoffMs ?? defaultBackoff;
  let reason: ChatFailureReason = "transport";
  let transient = false;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await oneAttempt(
        options.complete,
        messages,
        temperature,
        maxOutputTokens,
        timeoutMs,
      );
      const parsed = parseChatAnswer(completion.text, input.topics);
      if (parsed.ok) {
        return { answer: parsed.value, usage: completion.usage ?? {}, attempts: attempt };
      }
      reason = classifyReject(completion.text);
      transient = false;
    } catch (err) {
      reason = err instanceof AttemptTimeoutError ? "timeout" : "transport";
      transient = true;
    }
    if (attempt === 1) await sleep(backoff(random));
  }

  throw new StructuredParseError(2, reason, transient);
}

function classifyReject(text: string): ChatFailureReason {
  try {
    JSON.parse(text.trim().startsWith("{") ? text : extractLoose(text));
    return "schema_invalid";
  } catch {
    return "non_json";
  }
}

function extractLoose(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) return raw.slice(start, end + 1);
  return raw;
}
