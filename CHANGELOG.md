# Changelog

All notable changes to this package are documented here, in
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Versions follow semver, with an
honest `0.x` while the API settles.

A breaking change ships with a `### Migration` block giving the old call, the new call, and any
config change.

## [Unreleased]

## [0.1.1] - 2026-11-13

### Fixed

- Fence tags are stripped regardless of case, whitespace, or attributes, so untrusted text cannot close a block or open the verified actor block.
- A newline in stored history is indented, so a customer message cannot start a staff line.
- An actor id that contains a control character is rejected. A display name stays on one line.

## [0.1.0] - 2026-11-12

### Added

- `actorFromSession`: a session user is the speaker by default. An app page with no session user
  refuses the turn. A public page falls back to a visitor id.
- `runChatAgent` and `runChatTurn`: one read-only structured reply, one retry, then a failure that
  names a reason code and never the model text.
- A memory store on the `./testing` subpath whose writes all take the actor id.
- Panel config (`chatWidgetModel`) and a same-origin browser script. Replies are assigned as text.
- `scripts/no-leaks.mjs` and a tag-triggered publish workflow.
