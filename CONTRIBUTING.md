# Contributing to Kucedr

Help improve a personal desktop AI assistant for writing, research, coding, and creative work.
Contributions can include bug fixes, documentation, accessibility improvements, translations,
provider integrations, and focused features.

Read the [project overview](README.md) and [documentation index](docs/README.md) to find the relevant
area. Report vulnerabilities privately using [SECURITY.md](SECURITY.md).

## Getting Set Up

Use Node.js 22.19+ and npm 11.5.1+. Run these commands from the repository root:

```bash
npm ci
npm run dev
```

The root lockfile manages the desktop app, SDK, and CLI. A `website` workspace is also declared,
but its directory is absent in this checkout; its scripts cannot run until it is supplied. Do not add separate lockfiles to
`packages/sdk` or `packages/cli`.

If the normal command cannot start on Linux, `npm run dev-linux` disables Electron's sandbox for
local development. Do not use that override in production builds.

See [Development, Testing, and Deployment](docs/DEVELOPMENT.md) for environment configuration,
workspace commands, end-to-end setup, and release procedures.

## Choose and Scope a Change

1. Search existing issues and documentation before starting. For a substantial feature or behavior
   change, describe the problem and proposed approach in an issue first.
2. Keep the change focused on one problem. Match existing behavior, terminology, and design patterns.
3. Update the relevant guide when visible behavior, configuration, commands, or APIs change.
4. Include enough verification evidence for a reviewer to reproduce the result.

## Project Layout

| Path               | Responsibility                                                            |
| ------------------ | ------------------------------------------------------------------------- |
| `src/main`         | Electron lifecycle, agent runtime, models, integrations, storage, and IPC |
| `src/renderer/src` | React pages, components, state, and translations                          |
| `src/preload`      | Narrow, typed bridge from renderer to main process                        |
| `src/shared`       | Cross-process types and API contracts                                     |
| `packages/sdk`     | Embedded app APIs and optional compatible-server HTTP client              |
| `packages/cli`     | Desktop launcher, plugin installer, and terminal interface                |
| `resources`        | App assets, bundled apps, MCP examples, and provider manifests            |
| `tests`            | Jest main/renderer tests and Playwright end-to-end tests                  |
| `docs`             | Product guides, architecture, development, and operational references     |

## Verify Your Change

Run checks closest to the changed behavior during development:

```bash
npm run typecheck:app
npm run test:main -- tests/unit/main/agent/session/session-model-messages.test.ts
npm run test:renderer -- tests/unit/renderer/knowledge-settings.test.tsx
npm run sdk:test
npm run cli:test
```

The test paths above are examples; substitute the tests relevant to your change.
Before submitting code changes, run the full local quality gate:

```bash
npm run quality:check
```

This includes dependency audits, TypeScript, ESLint, and app/package tests. For Electron interface
or integration changes, build before running end-to-end tests:

```bash
npm run build
npm run test:e2e
```

Checked-in GitHub Actions workflows currently use `.yml.disabled` filenames, so automatic CI is
not a substitute for local evidence. Report the commands run, results, and any baseline failures.
Packaging and publishing checks belong to the [development and release guide](docs/DEVELOPMENT.md).

### Documentation Changes

For documentation-only changes, format and check only the touched files. For example:

```bash
npx prettier --write README.md CONTRIBUTING.md SECURITY.md
npx prettier --check README.md CONTRIBUTING.md SECURITY.md
git diff --check
```

Include any other changed Markdown paths in those commands. Verify local links and heading anchors,
check commands against `package.json`, and compare product claims with the current source. Preview
README artwork and layout before submitting. Label planned or unavailable capabilities explicitly;
link to canonical guides instead of duplicating configuration tables.

## Code Standards

- Use TypeScript; keep contracts in `src/shared` when they cross process boundaries.
- Follow the repository's Prettier and ESLint configuration. Avoid formatting unrelated files.
- Prefer the simplest implementation that satisfies the request, with no speculative abstractions.
- Split modules when responsibilities diverge, and put reused functions in shared modules.
- Keep provider-specific AI logic behind adapters in `src/main/models/adapters`.
- Create windows through `WindowFactory` and preserve its Electron security defaults.
- Follow the existing Tailwind CSS and shadcn component conventions for frontend changes.
- Cover behavior changes with focused tests and verify visible interface changes in the renderer.

[AGENTS.md](AGENTS.md) contains the full repository guidelines, including the workflow for
AI-assisted changes.

## Security Requirements

- Never commit API keys, tokens, private keys, or real credentials in examples, fixtures, or manifests.
- Avoid exposing secrets in logs, screenshots, tool events, or renderer responses. Use the existing
  credential-storage contract for the relevant subsystem; see [credential handling](SECURITY.md#credential-handling).
- Preserve sandboxing, context isolation, disabled Node integration, and web security in renderer windows.
- Enforce caller identity and path validation in the main process for IPC and embedded app APIs.
- Preserve agent permission rules, MCP approval settings, and channel access controls when adding actions.

## Commits and Pull Requests

- Keep commits focused and use descriptive subjects that state the concrete change.
- Describe the problem, resulting behavior, and why the change is needed.
- List verification performed and include screenshots for visible interface changes.
- Mention known limitations or baseline failures, and link any relevant issue.
- Keep unrelated refactors and formatting out of the change.

## Reporting Issues

Open an issue in the [GitHub issue tracker](https://github.com/HaraldBregu/kucedr/issues) with:

- Kucedr version, operating system, and architecture.
- Steps to reproduce, expected behavior, and actual behavior.
- Relevant provider or integration names and redacted logs, when applicable.

Remove credentials and private files from reports. For security vulnerabilities, follow the
private process in [SECURITY.md](SECURITY.md).

## License

Contributions are licensed under the project's [MIT License](LICENSE).
