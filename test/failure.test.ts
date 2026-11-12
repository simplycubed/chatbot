import { describe, expect, it } from "vitest";
import { chatFailureAction, shouldRetry } from "../src/failure.js";

describe("chatFailureAction", () => {
  it.each([
    [0, "retry"],
    [500, "retry"],
    [503, "retry"],
    [429, "rate_limited"],
    [400, "client_error"],
    [401, "client_error"],
    [404, "client_error"],
    [200, "client_error"],
  ] as const)("status %i is %s", (status, action) => {
    expect(chatFailureAction(status)).toBe(action);
  });
});

describe("shouldRetry", () => {
  it("retries only the first network or 5xx failure", () => {
    expect(shouldRetry(500, 0)).toBe(true);
    expect(shouldRetry(0, 0)).toBe(true);
    expect(shouldRetry(500, 1)).toBe(false);
    expect(shouldRetry(429, 0)).toBe(false);
    expect(shouldRetry(400, 0)).toBe(false);
  });
});
