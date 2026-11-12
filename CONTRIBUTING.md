# Contributing

This package is MIT. See `LICENSE`.

- Open a pull request against `main`. `pnpm check` is the required gate: lint, types, tests with coverage thresholds, build, and the leak scan.
- Do not add an attribution trailer, a generated-with line, or a tool footer to a commit, a pull request, or an issue.
- Do not put a product name, a personal name, a secret, or a model name in the source, the readme, or a commit message. The host application owns its prompt and its reference material.
- Publishing is a `v*` tag, never a merge. The tag must match `package.json`. Agents and contributors do not create that tag and do not publish. A maintainer publishes after the `publish` environment is approved.
