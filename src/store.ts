export type TicketStatus = "open" | "needs_human" | "closed";
export type MessageRole = "customer" | "agent" | "operator";
export type Confidence = "high" | "medium" | "low";

export interface ChatTicket {
  id: string;
  actorId: string;
  status: TicketStatus;
  topic?: string;
}

export interface StoredMessage {
  id: string;
  role: MessageRole;
  body: string;
  confidence?: Confidence;
}

export interface ChatThread {
  ticket: ChatTicket;
  messages: StoredMessage[];
}

/**
 * Every method takes the actor id and must apply it in the same statement as
 * the ticket id. A check-then-update by ticket id alone is not an implementation
 * of this interface. A miss returns null or throws not-found. It never falls
 * through to someone else's ticket.
 */
export interface ChatStore {
  getThread(actorId: string, ticketId: string): Promise<ChatThread | null>;
  /** Newest active ticket first. Active means open or waiting for a person. */
  listActive(actorId: string): Promise<ChatTicket[]>;
  createTicket(actorId: string): Promise<ChatTicket>;
  appendMessage(
    actorId: string,
    ticketId: string,
    message: { role: MessageRole; body: string; confidence?: Confidence },
  ): Promise<StoredMessage>;
  setTopic(actorId: string, ticketId: string, topic: string): Promise<void>;
  escalate(actorId: string, ticketId: string): Promise<void>;
  close(actorId: string, ticketId: string): Promise<void>;
}
