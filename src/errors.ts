/** A signed-in actor is required and none was bound. */
export class ChatActorRequiredError extends Error {
  constructor() {
    super("a signed-in actor is required");
    this.name = "ChatActorRequiredError";
  }
}

/** The ticket id is missing for this actor. Callers must treat this as not found. */
export class ChatTicketNotFoundError extends Error {
  constructor() {
    super("ticket not found");
    this.name = "ChatTicketNotFoundError";
  }
}

/** The customer message was empty or over the cap. */
export class ChatMessageError extends Error {
  constructor(readonly reason: "empty" | "too_long") {
    super(reason === "empty" ? "message is empty" : "message is too long");
    this.name = "ChatMessageError";
  }
}

export type ChatFailureReason = "non_json" | "schema_invalid" | "timeout" | "transport";

/**
 * Structured output failed after the one retry. `message` carries the reason code
 * only. The model text is never stored here.
 */
export class StructuredParseError extends Error {
  constructor(
    readonly attempts: number,
    readonly reason: ChatFailureReason,
    readonly transient: boolean,
  ) {
    super(`structured output failed after ${attempts} attempt(s): ${reason}`);
    this.name = "StructuredParseError";
  }
}
