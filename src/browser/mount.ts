import { chatFailureAction, shouldRetry } from "../failure.js";
import { parseReplyFrame } from "../reply.js";

export interface MountDocument {
  getElementById(id: string): MountElement | null;
  addEventListener(type: string, listener: (event: { key?: string }) => void): void;
}

export interface MountElement {
  hidden?: boolean;
  textContent: string | null;
  value?: string;
  disabled?: boolean;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: (event: MountEvent) => void): void;
  querySelector(selector: string): MountElement | null;
  appendChild(child: MountElement): void;
  ownerDocument?: { createElement(tag: string): MountElement };
}

export interface MountEvent {
  preventDefault(): void;
  key?: string;
  target?: MountElement | null;
}

interface Island {
  rootId: string;
  endpoints: { chat: string; resolve?: string; escalate?: string };
  csrf: string;
  labels: { retrying: string; rateLimited: string; failed: string; human: string };
}

export type MountFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ status: number; text(): Promise<string> }>;

function notice(thread: MountElement, text: string): void {
  const doc = thread.ownerDocument;
  if (!doc) {
    thread.textContent = text;
    return;
  }
  const node = doc.createElement("p");
  node.textContent = text;
  thread.appendChild(node);
}

function bubble(thread: MountElement, text: string): void {
  const doc = thread.ownerDocument;
  if (!doc) {
    thread.textContent = text;
    return;
  }
  const node = doc.createElement("p");
  node.textContent = text;
  thread.appendChild(node);
}

/**
 * Browser behavior for one panel. Replies are assigned with textContent.
 * The script reads endpoints and labels from the JSON island. It never reads
 * a user id from the page.
 */
export function mountChatWidget(doc: MountDocument, fetchImpl: MountFetch): void {
  const root = doc.getElementById("chat-widget");
  if (!root) return;
  const configNode = root.querySelector("script[type='application/json']");
  if (!configNode?.textContent) return;
  let island: Island;
  try {
    island = JSON.parse(configNode.textContent) as Island;
  } catch {
    return;
  }
  const launcher = doc.getElementById(`${island.rootId}-open`);
  const panel = doc.getElementById(`${island.rootId}-panel`);
  const closer = doc.getElementById(`${island.rootId}-close`);
  const form = doc.getElementById(`${island.rootId}-form`);
  const input = doc.getElementById(`${island.rootId}-input`);
  const thread = doc.getElementById(`${island.rootId}-thread`);
  if (!launcher || !panel || !closer || !form || !input || !thread) return;
  const openButton: MountElement = launcher;
  const panelEl: MountElement = panel;
  const closeButton: MountElement = closer;
  const formEl: MountElement = form;
  const inputEl: MountElement = input;
  const threadEl: MountElement = thread;

  let ticketId = "";
  let sending = false;

  function setOpen(open: boolean): void {
    panelEl.hidden = !open;
    openButton.setAttribute("aria-expanded", open ? "true" : "false");
  }

  openButton.addEventListener("click", () => setOpen(panelEl.hidden !== false));
  closeButton.addEventListener("click", () => setOpen(false));
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  async function post(url: string, body: Record<string, string>): Promise<void> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (island.csrf) headers["x-csrf-token"] = island.csrf;
    let status = 0;
    let text = "";
    let sawRetry = false;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30_000);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetchImpl(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: ac.signal,
          });
          status = response.status;
          text = await response.text();
        } catch {
          status = 0;
          text = "";
        }
        if (status >= 200 && status < 300) break;
        if (attempt === 0 && shouldRetry(status, attempt)) {
          sawRetry = true;
          notice(threadEl, island.labels.retrying);
          continue;
        }
        break;
      }
    } finally {
      clearTimeout(timer);
    }

    if (status >= 200 && status < 300) {
      const frame = parseReplyFrame(text);
      if (!frame) {
        notice(threadEl, island.labels.failed);
        return;
      }
      ticketId = frame.ticketId;
      bubble(threadEl, frame.reply);
      return;
    }
    if (sawRetry) notice(threadEl, island.labels.failed);
    else if (chatFailureAction(status) === "rate_limited")
      notice(threadEl, island.labels.rateLimited);
    else notice(threadEl, island.labels.failed);
  }

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();
    if (sending) return;
    const value = (inputEl.value ?? "").trim();
    if (!value) return;
    sending = true;
    inputEl.disabled = true;
    const payload: Record<string, string> = { message: value };
    if (ticketId) payload.ticketId = ticketId;
    void post(island.endpoints.chat, payload).finally(() => {
      sending = false;
      inputEl.disabled = false;
      inputEl.value = "";
    });
  });
}
