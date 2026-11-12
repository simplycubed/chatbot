# Spec

`@simplycubed/chatbot` runs one chat turn. It does not know which product it is inside, and it does
not know how that product stores rows or calls a model.

## Audience

- `app` is the default. `actorFromSession` requires a user id from the host session. A visitor is
  rejected. The browser does not send the user id.
- `public` is a page anyone can open. When the session has a user id, that user is the speaker.
  When it does not, the host passes a visitor id it minted on the server.

The verified actor is added to every prompt. The host does not have to remember to include it.

## Turn

1. Reject an empty or oversized message.
2. A client ticket id that is not this actor's ticket is not found. The turn does not continue a
   different ticket.
3. Otherwise continue the newest active ticket, or open one.
4. Store the customer message.
5. Ask the host for references. A lookup failure is an empty list.
6. Call `complete` with the host's instructions, the actor, the grounding, the references, and the
   recent thread. Untrusted text is fenced in the user message. It is not copied into the system
   message. There are no tools.
7. On a good answer, store the assistant message. On a failure, store nothing for the assistant.
   A second failure in a row marks the ticket as needing a person. The package does not send mail.

## Browser

The host renders the panel and serves `browser/chat-widget.js` and `browser/chat-widget.css` from
its own origin. The script reads a JSON island. A failed send retries once on a network failure or
a 5xx, and does not retry a 429 or any other 4xx. Reply text is assigned with `textContent`.
