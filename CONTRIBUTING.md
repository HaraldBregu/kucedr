# Contributing to Kucedr

Thanks for your interest in contributing! This document describes how to set up the project, the quality bar for changes, and the conventions used in this repository.

## Getting Set Up

Requirements:

- Node.js 22.19+
- npm 11.5.1+

```bash
npm ci
npm run dev
```

On Linux environments that require Electron sandbox changes, use `npm run dev-linux`.

## Project Layout

- `src/main` — Electron main process: agent (runs, tools, skills, sessions, cron, health, sandbox, permission policy), channels, providers, image, voice, transcribe, IPC, and app services.
- `src/renderer/src` — React UI (pages, components, hooks, contexts, i18n).
- `src/preload` — typed preload bridge; expose narrow, typed IPC methods only.
- `src/shared` — cross-process types and API contracts.
- `resources` — icons, i18n resources, templates.
- `tests` — unit tests (Jest) split into `main` and `renderer` projects; e2e via Playwright.
- `docs` — product, development, testing, and deployment documentation.

## Quality Gates

Run the local release checks before opening a pull request. Checked-in CI workflows are currently
disabled (`.github/workflows/*.yml.disabled`):

```bash
npm ci
npm run typecheck
npm run build
npm run test:packages
npm run build:packages
npm pack --dry-run --workspace @kucedr/sdk
npm pack --dry-run --workspace @kucedr/cli
```

Additional commands:

```bash
npm run quality:check    # Full lint and app/package test suite
npm run build            # Required before npm run test:e2e
npm run test:e2e         # Playwright Electron end-to-end tests
npm run format           # prettier --write .
npm run format:check     # prettier --check .
```

Run the full `quality:check` before submitting changes.

The complete workflow, including targeted workspace tests and end-to-end setup, is in
[Development, Testing, and Deployment](docs/DEVELOPMENT.md).

## Code Standards

- TypeScript throughout; keep types in `src/shared` when they cross process boundaries.
- Formatting is enforced by Prettier and linting by ESLint — run them rather than hand-formatting.
- Prefer the simplest solution that satisfies the request; no speculative abstractions or configurability.
- Keep changes surgical: touch only what the change requires and match the existing style of surrounding code.
- Module-based file structure: split files when responsibilities diverge; move shared functions into their own files. Prefer short, one-word filenames.
- Provider-specific AI logic stays behind provider adapters in `src/main/models/adapters` — it must not leak into agent or UI code.
- Create browser windows through `WindowFactory` so Electron security defaults stay consistent.
- Frontend work follows the existing design system (Tailwind CSS + shadcn-style components); don't invent custom visual patterns.

See [AGENTS.md](AGENTS.md) for the full behavioral guidelines, which also apply to AI-assisted contributions.

## Security Requirements

- Never commit secrets (API keys, tokens, credentials). Patterns like `*.env`, `*.pem`, `*.key`, and `credentials.json` must stay out of commits.
- Don't log, render, or store secrets in plaintext where avoidable.
- Renderer windows must keep sandboxing, context isolation, disabled Node integration, and web security enabled.
- Any tool or connector action that writes, deletes, publishes, or accesses private data must pass explicit permission checks.

See [SECURITY.md](SECURITY.md) for the security policy.

## Commits and Pull Requests

- Keep commits small and focused — one logical change per commit.
- Write descriptive, lower-case subjects that state what changed and where, matching the existing history (e.g. `early return added when sessionsPath is missing in persist`).
- Before opening a PR: run the local checks above, describe what changed and why,
  and note any full-suite baseline failures or follow-up work.
- Don't bundle unrelated refactors or formatting changes with a functional change.

## Reporting Issues

Open a GitHub issue at the [project repository](https://github.com/HaraldBregu/kucedr) with steps to reproduce, expected vs. actual behavior, and your platform (OS, app version). For security vulnerabilities, do **not** open a public issue — follow [SECURITY.md](SECURITY.md) instead.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
