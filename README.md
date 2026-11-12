# @simplycubed/chatbot

A small, dependency-free TypeScript library for one read-only chat turn.

The host supplies the prompt, the reference snippets, and the session. On an app page the turn
refuses to run until that session has a user. On a public page the same call uses the signed-in
user when there is one, and a server-minted visitor id when there is not. The browser never sends
the user id.

The package owns no database, no mailer, and no model gateway. It does not name an assistant.
Display name, greeting, and avatar are host config.

## Install

```sh
pnpm add @simplycubed/chatbot
```

## One turn

```ts
import { actorFromSession, runChatTurn } from "@simplycubed/chatbot";

const actor = actorFromSession(session); // app page: throws when session.userId is missing

const result = await runChatTurn(
  {
    store, // your adapter. Every method takes the actor id.
    complete, // your gateway client. No tools.
    lookupReferences: async (question) => [{ title: "Guide", snippet: "..." }],
  },
  {
    actor,
    message,
    ticketId, // omitted continues the newest active ticket. A foreign id is not found.
    instructions, // your prompt
    topics: ["billing", "other"],
    residualTopic: "other",
    grounding, // text you rendered for this actor only
  },
);
```

A public page passes `{ audience: "public", visitorId }`. A signed-in user on that page is still
the speaker, because `actorFromSession` prefers the session user.

A failed model call stores the customer message, stores no assistant message, and returns
`degraded: true`. The error text is a reason code. A second failure in a row marks the ticket as
needing a person. This package does not send mail.

## Panel

Render `chatWidgetModel(...).persona` and the labels in your own markup, escaping them with your
template engine. Point a same-origin script tag at `browser/chat-widget.js` and the stylesheet at
`browser/chat-widget.css`. Set `--chat-accent` and the other `--chat-*` variables in your own
stylesheet. The script retries a network failure or a 5xx once, and does not retry a 429 or any
other 4xx. Replies are assigned with `textContent`.

## Development

```sh
pnpm install
pnpm check
```

Node 24 or newer. See `CONTRIBUTING.md` for pull requests and releases.

## License

MIT
