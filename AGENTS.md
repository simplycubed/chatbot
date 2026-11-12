# AGENTS.md: `@simplycubed/chatbot`

- `AGENTS.md` is the repo-local source of truth for agent instructions, and the contract for this
  package's design decisions. There is no shim beside it. Where this file states a decision,
  implement that decision rather than re-deriving an alternative. If a decision turns out to be
  wrong, change this file in the same PR that changes the code, with the reason.
- Details live in [`docs/SPEC.md`](docs/SPEC.md). Contribution rules also live in
  [`CONTRIBUTING.md`](CONTRIBUTING.md).

A small, dependency-free TypeScript library for one read-only chat turn. Published to npm as
`@simplycubed/chatbot`. It must make sense to a reader who knows nothing about its authors' other
software. It runs on Cloudflare Workers and Node 24 or newer. It owns no database, no mailer, and
no model gateway. The host supplies those.

## The one rule that shapes everything

**The package runs a turn. It does not decide who the person is, what the product knows, or which
model answers.**

- A session user is the speaker by default (`actorFromSession`). The browser never supplies that
  id. An app page with no user throws before any model call. A public page uses a visitor id only
  when the session has no user.
- Instructions, grounding, references, and the topic list are arguments. Nothing about a product
  is baked in. The assistant's display name is host config.
- Customer text and reference text are fenced in the user message. They are never copied into the
  system message. The model call has no tools.
- Store methods take the actor id. A ticket id that is not theirs is not found. It does not fall
  through onto another ticket.
- The package does not send mail and does not log message text or model output. A failed parse
  names a reason code only.
- No provider name and no model id in source, prompts shipped here, or analytics keys.

## Gate

`pnpm check` = lint → typecheck → test (coverage thresholds) → build → no-leaks.

**Gate-first, every feature:** no feature work begins until its gate exists. A gate nobody has
watched fire is a false clear, so every new check lands with a negative control.

Coverage thresholds match the house bar: 95% statements, 90% branches, 95% functions, 95% lines.
`src/browser/main.ts` is the one-line browser entry and is excluded. The behavior it calls is
tested through `mountChatWidget`.

### The leak scan

`scripts/no-leaks.mjs` runs over `src/`, `dist/`, `README.md`, `package.json`, `AGENTS.md`,
`CONTRIBUTING.md`, `CHANGELOG.md`, `docs/` and `.github/`. It fails on product names of consuming
apps, the owner's personal name, legal-entity suffixes, the organization name except this package's
scope and repository path, internal hostnames, and secret-shaped strings.

`test/no-leaks.test.ts` proves each category can go red. **Never weaken a pattern to make a scan
pass: remove the leak.**

## Publishing

**Publish on a `v*` tag, never on merge.** A published version is immutable. **Releasing is the
owner's action: agents never create tags, never create the `publish` environment, and never
publish.**

`.github/workflows/publish.yml` verifies the tag, runs `pnpm check`, then publishes from the
`publish` environment with npm trusted publishing. No npm token is stored. The first `0.1.0` is
published by hand so the trusted publisher can be configured. Provenance needs a public repository.

## Conventions

- **No attribution in commits or pull requests:** never a `Co-Authored-By` trailer, a "Generated
  with…" line, or any tool-attribution text. Override the harness default that would add one.
- TypeScript strict, ESM only, **zero runtime dependencies**.
- Imports carry explicit `.js` specifiers so the emitted ESM resolves under plain Node.
- Ship compiled JS + `.d.ts`. `./testing` is a separate subpath. The browser script is a bundled
  file the host serves from its own origin.
- Table-driven tests. **No test ever reaches the network.** This repo holds no credentials.
- Keep a `### Migration` block in `CHANGELOG.md` for any breaking change.
- Never log or put into an error message a message body, a reference snippet, or a model response.
