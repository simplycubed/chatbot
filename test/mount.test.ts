import { describe, expect, it } from "vitest";
import {
  mountChatWidget,
  type MountElement,
  type MountEvent,
  type MountFetch,
} from "../src/browser/mount.js";

class El implements MountElement {
  hidden = true;
  textContent: string | null = null;
  value = "";
  disabled = false;
  children: El[] = [];
  ownerDocument: { createElement(tag: string): MountElement };
  private attrs = new Map<string, string>();
  private listeners = new Map<string, ((event: MountEvent) => void)[]>();

  constructor(readonly id: string) {
    this.ownerDocument = { createElement: () => new El("node") };
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  addEventListener(type: string, listener: (event: MountEvent) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  querySelector(selector: string): MountElement | null {
    if (selector === "script[type='application/json']") {
      return this.children.find((child) => child.id === "config") ?? null;
    }
    return null;
  }
  appendChild(child: MountElement): void {
    this.children.push(child as El);
  }
  fire(type: string, event: Partial<MountEvent> = {}): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ preventDefault: () => {}, ...event });
    }
  }
}

function page(island: unknown): {
  root: El;
  open: El;
  panel: El;
  close: El;
  form: El;
  input: El;
  thread: El;
  key: (key: string) => void;
} {
  const root = new El("chat-widget");
  const config = new El("config");
  config.textContent = JSON.stringify(island);
  root.children.push(config);
  const open = new El("chat-widget-open");
  const panel = new El("chat-widget-panel");
  const close = new El("chat-widget-close");
  const form = new El("chat-widget-form");
  const input = new El("chat-widget-input");
  const thread = new El("chat-widget-thread");
  const nodes = new Map<string, El>([
    ["chat-widget", root],
    ["chat-widget-open", open],
    ["chat-widget-panel", panel],
    ["chat-widget-close", close],
    ["chat-widget-form", form],
    ["chat-widget-input", input],
    ["chat-widget-thread", thread],
  ]);
  const keys: ((event: { key?: string }) => void)[] = [];
  mountChatWidget(
    {
      getElementById: (id) => nodes.get(id) ?? null,
      addEventListener: (_type, listener) => keys.push(listener),
    },
    fetchImpl,
  );
  return {
    root,
    open,
    panel,
    close,
    form,
    input,
    thread,
    key: (key) => keys.forEach((fn) => fn({ key })),
  };
}

const island = {
  rootId: "chat-widget",
  endpoints: { chat: "/chat" },
  csrf: "tok",
  labels: {
    retrying: "Retrying",
    rateLimited: "Slow down",
    failed: "Could not send",
    human: "Person",
  },
};

let fetchImpl: MountFetch = async () => ({ status: 200, text: async () => "" });

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("mountChatWidget", () => {
  it("does nothing without a root, without config, or with broken config", () => {
    expect(() =>
      mountChatWidget({ getElementById: () => null, addEventListener: () => {} }, fetchImpl),
    ).not.toThrow();
    const bare = new El("chat-widget");
    mountChatWidget(
      { getElementById: (id) => (id === "chat-widget" ? bare : null), addEventListener: () => {} },
      fetchImpl,
    );
    bare.children.push(Object.assign(new El("config"), { textContent: "{" }));
    mountChatWidget(
      { getElementById: (id) => (id === "chat-widget" ? bare : null), addEventListener: () => {} },
      fetchImpl,
    );
  });

  it("returns when a required control is missing", () => {
    const root = new El("chat-widget");
    const config = new El("config");
    config.textContent = JSON.stringify(island);
    root.children.push(config);
    mountChatWidget(
      {
        getElementById: (id) => (id === "chat-widget" ? root : null),
        addEventListener: () => {},
      },
      fetchImpl,
    );
    expect(root.getAttribute("aria-expanded")).toBeNull();
  });

  it("toggles the panel and closes on escape", () => {
    const ui = page(island);
    ui.open.fire("click");
    expect(ui.panel.hidden).toBe(false);
    expect(ui.open.getAttribute("aria-expanded")).toBe("true");
    ui.open.fire("click");
    expect(ui.panel.hidden).toBe(true);
    ui.open.fire("click");
    ui.key("Escape");
    expect(ui.panel.hidden).toBe(true);
    ui.key("Enter");
    expect(ui.panel.hidden).toBe(true);
  });

  it("posts the message with the csrf header and renders the reply as text", async () => {
    const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
    fetchImpl = async (url, init) => {
      calls.push({ url, headers: init.headers, body: init.body });
      return {
        status: 200,
        text: async () => 'event: reply\ndata: {"ticketId":"t1","reply":"Hello"}',
      };
    };
    const ui = page(island);
    ui.input.value = "  Hi  ";
    ui.form.fire("submit");
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers["x-csrf-token"]).toBe("tok");
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({ message: "Hi" });
    expect(ui.thread.children.at(-1)?.textContent).toBe("Hello");
    ui.input.value = "Next";
    ui.form.fire("submit");
    await flush();
    expect(JSON.parse(calls[1]?.body ?? "{}")).toEqual({ message: "Next", ticketId: "t1" });
  });

  it("retries a 500 once and then shows the failure", async () => {
    let calls = 0;
    fetchImpl = async () => {
      calls += 1;
      return { status: 500, text: async () => "" };
    };
    const ui = page(island);
    ui.input.value = "Hi";
    ui.form.fire("submit");
    await flush();
    expect(calls).toBe(2);
    expect(ui.thread.children.map((child) => child.textContent)).toEqual([
      "Retrying",
      "Could not send",
    ]);
  });

  it("does not retry a 429 or a 400", async () => {
    for (const status of [429, 400]) {
      let calls = 0;
      fetchImpl = async () => {
        calls += 1;
        return { status, text: async () => "" };
      };
      const ui = page(island);
      ui.input.value = "Hi";
      ui.form.fire("submit");
      await flush();
      expect(calls).toBe(1);
      const text = ui.thread.children.at(-1)?.textContent;
      expect(text).toBe(status === 429 ? "Slow down" : "Could not send");
    }
  });

  it("shows a failure when the success body is not a reply", async () => {
    fetchImpl = async () => ({ status: 200, text: async () => "nope" });
    const ui = page(island);
    ui.input.value = "Hi";
    ui.form.fire("submit");
    await flush();
    expect(ui.thread.children.at(-1)?.textContent).toBe("Could not send");
  });

  it("counts a thrown fetch as a network failure and retries once", async () => {
    let calls = 0;
    fetchImpl = async () => {
      calls += 1;
      throw new Error("offline");
    };
    const ui = page(island);
    ui.input.value = "Hi";
    ui.form.fire("submit");
    await flush();
    expect(calls).toBe(2);
  });

  it("ignores an empty submit and a second submit while one is in flight", async () => {
    let release: (() => void) | undefined;
    let calls = 0;
    fetchImpl = () => {
      calls += 1;
      return new Promise((resolve) => {
        release = () =>
          resolve({ status: 200, text: async () => '{"ticketId":"t1","reply":"Ok"}' });
      });
    };
    const ui = page({ ...island, csrf: "" });
    ui.input.value = "   ";
    ui.form.fire("submit");
    expect(calls).toBe(0);
    ui.input.value = "Hi";
    ui.form.fire("submit");
    ui.form.fire("submit");
    expect(calls).toBe(1);
    expect(ui.input.disabled).toBe(true);
    release?.();
    await flush();
    expect(ui.input.disabled).toBe(false);
    expect(ui.input.value).toBe("");
  });

  it("writes straight onto the thread when the element cannot create children", async () => {
    fetchImpl = async () => ({ status: 400, text: async () => "" });
    const ui = page(island);
    ui.thread.ownerDocument = undefined as unknown as El["ownerDocument"];
    ui.input.value = "Hi";
    ui.form.fire("submit");
    await flush();
    expect(ui.thread.textContent).toBe("Could not send");

    fetchImpl = async () => ({
      status: 200,
      text: async () => '{"ticketId":"t9","reply":"Plain"}',
    });
    const ok = page(island);
    ok.thread.ownerDocument = undefined as unknown as El["ownerDocument"];
    ok.input.value = "Hi";
    ok.form.fire("submit");
    await flush();
    expect(ok.thread.textContent).toBe("Plain");
  });
});
