import { ChatTicketNotFoundError } from "../errors.js";
import type { ChatStore, ChatTicket, ChatThread, StoredMessage } from "../store.js";

/**
 * In-memory store for tests and local fakes. Every write loads the thread with
 * the actor id and throws when that pair misses. There is no update-by-id path.
 */
export function createMemoryChatStore(): ChatStore {
  const tickets: ChatTicket[] = [];
  const messages = new Map<string, StoredMessage[]>();
  let ticketSeq = 0;
  let messageSeq = 0;

  function thread(actorId: string, ticketId: string): ChatThread | null {
    const ticket = tickets.find((item) => item.id === ticketId && item.actorId === actorId);
    if (!ticket) return null;
    return { ticket, messages: messages.get(ticket.id) ?? [] };
  }

  function requireThread(actorId: string, ticketId: string): ChatThread {
    const found = thread(actorId, ticketId);
    if (!found) throw new ChatTicketNotFoundError();
    return found;
  }

  return {
    async getThread(actorId, ticketId) {
      const found = thread(actorId, ticketId);
      return found ? { ticket: found.ticket, messages: [...found.messages] } : null;
    },
    async listActive(actorId) {
      return tickets
        .filter(
          (item) =>
            item.actorId === actorId && (item.status === "open" || item.status === "needs_human"),
        )
        .slice()
        .reverse();
    },
    async createTicket(actorId) {
      ticketSeq += 1;
      const ticket: ChatTicket = { id: `t${ticketSeq}`, actorId, status: "open" };
      tickets.push(ticket);
      messages.set(ticket.id, []);
      return ticket;
    },
    async appendMessage(actorId, ticketId, message) {
      const found = requireThread(actorId, ticketId);
      messageSeq += 1;
      const stored: StoredMessage = {
        id: `m${messageSeq}`,
        role: message.role,
        body: message.body,
        confidence: message.confidence,
      };
      const list = messages.get(found.ticket.id) ?? [];
      list.push(stored);
      messages.set(found.ticket.id, list);
      return stored;
    },
    async setTopic(actorId, ticketId, topic) {
      requireThread(actorId, ticketId).ticket.topic = topic;
    },
    async escalate(actorId, ticketId) {
      requireThread(actorId, ticketId).ticket.status = "needs_human";
    },
    async close(actorId, ticketId) {
      requireThread(actorId, ticketId).ticket.status = "closed";
    },
  };
}
