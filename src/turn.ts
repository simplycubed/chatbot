import { assertActor, type ChatActor, type ChatAudience } from "./actor.js";
import { runChatAgent, type ChatAgentResult, type ChatComplete } from "./agent.js";
import { ChatMessageError, ChatTicketNotFoundError } from "./errors.js";
import type { ChatHistoryTurn, ChatReference } from "./prompt.js";
import type { ChatStore, ChatTicket, StoredMessage } from "./store.js";

export const DEGRADED_REPLY = "I could not answer that just now. Please try again in a moment.";
export const DEFAULT_MAX_MESSAGE_CHARS = 4_000;
export const DEFAULT_HISTORY_TURNS = 8;

export interface RunChatTurnInput {
  audience?: ChatAudience;
  actor: ChatActor;
  message: string;
  ticketId?: string;
  instructions: string;
  topics: readonly string[];
  residualTopic: string;
  grounding?: string;
}

export interface RunChatTurnDeps {
  store: ChatStore;
  complete: ChatComplete;
  lookupReferences?: (question: string) => Promise<ChatReference[]>;
  maxMessageChars?: number;
  historyTurns?: number;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  backoffMs?: (random: () => number) => number;
}

export interface ChatTurnResult {
  ticketId: string;
  reply: string;
  topicCategory: string;
  confidence: "high" | "medium" | "low";
  escalated: boolean;
  degraded: boolean;
  newTicket: boolean;
  messageChars: number;
  priorCustomerMessages: number;
  priorAgentMessages: number;
  referenceCount: number;
  attempts: number;
  inputTokens: number;
  outputTokens: number;
  outcome: "answered" | "could_not_help" | "degraded";
  escalateReason?: string;
}

function historyFrom(messages: StoredMessage[], limit: number): ChatHistoryTurn[] {
  const usable = messages.filter(
    (m): m is StoredMessage & { role: ChatHistoryTurn["role"] } =>
      m.role === "customer" || m.role === "agent" || m.role === "operator",
  );
  return usable.slice(-limit).map((m) => ({ role: m.role, body: m.body }));
}

function counts(messages: StoredMessage[]): { customer: number; agent: number } {
  let customer = 0;
  let agent = 0;
  for (const m of messages) {
    if (m.role === "customer") customer += 1;
    else if (m.role === "agent") agent += 1;
  }
  return { customer, agent };
}

/**
 * One turn. The customer message is stored before the model call. A model
 * failure does not store an assistant message. A client ticket id that is not
 * this actor's ticket throws, and does not continue a different ticket.
 */
export async function runChatTurn(
  deps: RunChatTurnDeps,
  input: RunChatTurnInput,
): Promise<ChatTurnResult> {
  const audience = input.audience ?? "app";
  assertActor(audience, input.actor);
  const maxChars = deps.maxMessageChars ?? DEFAULT_MAX_MESSAGE_CHARS;
  const message = input.message.trim();
  if (!message) throw new ChatMessageError("empty");
  if (message.length > maxChars) throw new ChatMessageError("too_long");
  if (!input.topics.includes(input.residualTopic)) {
    throw new Error("residual topic is not in the topic list");
  }

  const actorId = input.actor.id;
  let ticket: ChatTicket | null = null;
  let prior: StoredMessage[] = [];
  if (input.ticketId) {
    const thread = await deps.store.getThread(actorId, input.ticketId);
    if (!thread) throw new ChatTicketNotFoundError();
    ticket = thread.ticket;
    prior = thread.messages;
  }
  let newTicket = false;
  if (!ticket) {
    const active = await deps.store.listActive(actorId);
    const latest = active[0];
    if (latest) {
      ticket = latest;
      prior = (await deps.store.getThread(actorId, latest.id))?.messages ?? [];
    } else {
      ticket = await deps.store.createTicket(actorId);
      newTicket = true;
    }
  }

  const priorCounts = counts(prior);
  await deps.store.appendMessage(actorId, ticket.id, { role: "customer", body: message });

  let references: ChatReference[] = [];
  if (deps.lookupReferences) {
    try {
      references = await deps.lookupReferences(message);
    } catch {
      references = [];
    }
  }

  const base = {
    ticketId: ticket.id,
    newTicket,
    messageChars: message.length,
    priorCustomerMessages: priorCounts.customer,
    priorAgentMessages: priorCounts.agent,
    referenceCount: references.length,
  };

  let result: ChatAgentResult;
  try {
    result = await runChatAgent(
      {
        instructions: input.instructions,
        actor: input.actor,
        grounding: input.grounding,
        references,
        history: historyFrom(prior, deps.historyTurns ?? DEFAULT_HISTORY_TURNS),
        question: message,
        topics: input.topics,
        residualTopic: input.residualTopic,
      },
      {
        complete: deps.complete,
        temperature: deps.temperature,
        maxOutputTokens: deps.maxOutputTokens,
        timeoutMs: deps.timeoutMs,
        backoffMs: deps.backoffMs,
      },
    );
  } catch {
    const repeated = priorCounts.customer > priorCounts.agent;
    if (repeated) await deps.store.escalate(actorId, ticket.id);
    return {
      ...base,
      reply: DEGRADED_REPLY,
      topicCategory: input.residualTopic,
      confidence: "low",
      escalated: repeated,
      degraded: true,
      attempts: 2,
      inputTokens: 0,
      outputTokens: 0,
      outcome: "degraded",
      escalateReason: repeated ? "repeated_failure" : undefined,
    };
  }

  await deps.store.appendMessage(actorId, ticket.id, {
    role: "agent",
    body: result.answer.reply,
    confidence: result.answer.confidence,
  });
  await deps.store.setTopic(actorId, ticket.id, result.answer.topic_category);
  if (result.answer.escalate) await deps.store.escalate(actorId, ticket.id);

  return {
    ...base,
    reply: result.answer.reply,
    topicCategory: result.answer.topic_category,
    confidence: result.answer.confidence,
    escalated: result.answer.escalate,
    degraded: false,
    attempts: result.attempts,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    outcome: result.answer.outcome,
    escalateReason: result.answer.escalate_reason,
  };
}
