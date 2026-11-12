import { describe, expect, it } from "vitest";
import { chatWidgetModel, safeJsonForScript } from "../src/widget.js";
import { parseReplyFrame } from "../src/reply.js";

const config = {
  persona: {
    name: "Helper",
    subtitle: "Replies in seconds",
    greeting: "Ask a question.",
    avatarUrl: "/avatar.png",
  },
  endpoints: { chat: "/chat", resolve: "/resolve" },
  csrf: "tok",
  labels: {
    placeholder: "Type",
    send: "Send",
    close: "Close",
    open: "Open",
    human: "Talk to a person",
    resolve: "Resolve",
    retrying: "Retrying",
    rateLimited: "Slow down",
    failed: "Could not send",
  },
  scriptSrc: "/chat-widget.js",
  styleHref: "/chat-widget.css",
};

describe("safeJsonForScript", () => {
  it("escapes characters that would close a script element", () => {
    const encoded = safeJsonForScript({ q: "</script>\u2028\u2029>" });
    expect(encoded).not.toContain("<");
    expect(encoded).not.toContain(">");
    expect(encoded).toContain("\\u003c");
    expect(JSON.parse(encoded)).toEqual({ q: "</script>\u2028\u2029>" });
  });
});

describe("chatWidgetModel", () => {
  it("puts endpoints and labels in the island and keeps the persona for the host", () => {
    const model = chatWidgetModel(config);
    expect(model.rootId).toBe("chat-widget");
    expect(model.persona.name).toBe("Helper");
    expect(model.scriptSrc).toBe("/chat-widget.js");
    const island = JSON.parse(model.configJson) as { csrf: string; endpoints: { chat: string } };
    expect(island.csrf).toBe("tok");
    expect(island.endpoints.chat).toBe("/chat");
  });

  it("honors a host root id and an omitted csrf token", () => {
    const model = chatWidgetModel({ ...config, rootId: "panel", csrf: undefined });
    expect(model.rootId).toBe("panel");
    expect(JSON.parse(model.configJson).csrf).toBe("");
  });
});

describe("parseReplyFrame", () => {
  it("reads an event frame and a bare object", () => {
    expect(
      parseReplyFrame('event: reply\ndata: {"ticketId":"t1","reply":"Hi","escalated":true}\n'),
    ).toEqual({
      ticketId: "t1",
      reply: "Hi",
      escalated: true,
    });
    expect(parseReplyFrame('{"ticketId":"t1","reply":"Hi"}')).toEqual({
      ticketId: "t1",
      reply: "Hi",
      escalated: false,
    });
  });

  it.each([
    "",
    "event: reply\n",
    "event: reply\ndata: {",
    "{",
    "[]",
    "null",
    '{"reply":""}',
    '{"reply":"Hi","ticketId":""}',
    '{"ticketId":"t1"}',
  ])("rejects %j", (body) => {
    expect(parseReplyFrame(body)).toBeNull();
  });
});
