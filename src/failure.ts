export type ChatFailureAction = "retry" | "rate_limited" | "client_error";

/**
 * What the panel does with a failed send. Status 0 is the browser's network
 * failure. 5xx is retried once. 429 is shown as rate limited and not retried.
 * Every other 4xx is a client error and not retried.
 */
export function chatFailureAction(status: number): ChatFailureAction {
  if (status === 0 || status >= 500) return "retry";
  if (status === 429) return "rate_limited";
  return "client_error";
}

/** True only for the first failure that the action says to retry. */
export function shouldRetry(status: number, attemptsSoFar: number): boolean {
  return attemptsSoFar === 0 && chatFailureAction(status) === "retry";
}
