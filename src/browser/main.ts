import { mountChatWidget, type MountDocument, type MountFetch } from "./mount.js";

const doc = (globalThis as { document?: MountDocument }).document;
if (doc) {
  mountChatWidget(doc, globalThis.fetch as MountFetch);
}
