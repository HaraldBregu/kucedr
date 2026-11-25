# 22. Quality: tests, CI and docs accuracy

Part of the [Roadmap](README.md). Status: 22.1 done 2026-11-25; 22.2–22.4 open.

Not user-facing features, but what keeps the features above from regressing.

## 22.1 progress, 2026-11-25

- `npm run lint` runs again: the React version is pinned in `eslint.config.mjs`, because
  `eslint-plugin-react` cannot detect it under ESLint 10. It reports 0 errors and about 90 warnings.
- Jest: 433 suites, 2453 tests, all passing (was 162 failing suites and 482 failing tests). Suites
  for removed features were deleted (plan and goal modes, media adapters now in plugin manifests,
  the Codex and Pi coding runtimes, app import, bundled MCP demo servers). The rest were updated to
  the current APIs.
- `iteracompute/models/qwen3.8-flash` and `openrouter/models/auto` link their model pages as
  `contextWindowDocumentationUrl`; each page states the context window the manifest uses.
- Found while doing this, all fixed:
  - Creating the first file in an empty workspace never showed the name field
    (`pages/workspace/Sidebar.tsx`).
  - The "Set … in the plugin settings" error in `src/main/mcp/oauth_options.ts` named no
    settings, because `pluginProvider()` dropped `settings`. It now keeps each setting's key,
    title, type and whether it is required.
  - `src/main/models/adapters/tts/tts_synthesizer.ts` fell back to a hard-coded provider URL; it
    now uses the provider's configured URL only.
  - `clearMocks`, `resetMocks` and `restoreMocks` at the root of `jest.config.cjs` never applied,
    because Jest reads them per project. `clearMocks` is now set on both projects. Turning on
    `resetMocks` and `restoreMocks` as well fails 34 suites (153 tests) that set mock behaviour
    once per file, so they were removed rather than enabled.

## What exists today

- CI (`.github/workflows/pipeline.yml`) runs audit, typecheck, lint, unit tests, the build,
  end-to-end tests and packaging on three systems.
- `tests/integration` is empty.
- A coverage threshold is set in `jest.config.cjs`, but CI never runs the coverage job.
- Every test suite loads and passes locally (see 22.1 progress above). Whether CI is currently
  green is _not verified_.
- There is no accessibility check ([Accessibility](ACCESSIBILITY.md), 4.5). The performance
  check ([Performance](PERFORMANCE.md), 2.7) runs by hand before a release, not in CI, and the
  terminal smoke test is not in CI ([Terminal](TERMINAL.md), 14.7).

## Features

| # | Feature | What it gives | Builds on | Size |
| --- | --- | --- | --- | --- |
| 22.1 | Green baseline | Every test suite loads and passes, or is removed with its dead code | The existing suites | M |
| 22.2 | Coverage in CI | The coverage threshold is enforced on every change | `jest.config.cjs` | S |
| 22.3 | Real-app checks | A small set of end-to-end runs through the built app: first run, a chat with tools, a long chat, settings | The existing end-to-end specs | M |
| 22.4 | Docs match the app | The stale statements below are corrected, and each feature doc names its status | [Documentation index](../README.md) | S |

## Documentation known to be out of date

- [FEATURES.md](../FEATURES.md): the provider count, and a signed installer that is not signed.
- [APPS.md](../APPS.md): says no apps are bundled; several are.
- [CLOUD.md](../CLOUD.md) and the root security policy: describe sync and cloud chat records as
  live, and mention messaging providers that do not exist.
- [Security audit](../SECURITY_AUDIT.md): status table behind
  [PERMISSIONS_PLAN.md](../PERMISSIONS_PLAN.md).
- [Terminal](../TERMINAL.md): an install step the project does not use.
- [Settings](../ui/SETTINGS.md): says data Purge has no confirmation; it has a native one.
- [Home](../ui/HOME.md): does not mention pin, archive or categories _(reported, not verified)_.

## Open decisions

- **22.1 first.** New checks are worth little on top of suites that do not load.
- Tests are added only when asked for; this area records where they are missing.
