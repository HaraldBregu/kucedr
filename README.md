<p align="center">
  <img src="resources/icons/icon.svg" alt="Kucedr logo" width="144" />
</p>

<h1 align="center">Kucedr</h1>

<p align="center">
  <strong>Your desktop AI copilot for everyday tasks.</strong>
</p>

Kucedr is a cross-platform desktop AI assistant that turns conversations into actions. Type or speak a request, attach images or PDFs, and let the agent work with files, run commands, research the web, create media, or automate a recurring task.

You choose the providers and models behind each AI capability. Kucedr keeps its settings,
conversations, and workspace data on your machine. Provider keys are encrypted locally when secure
device storage is available, and signed-in users can optionally enable end-to-end encrypted key
sync. Requests are sent only to the AI providers and connected services you configure.

## What Kucedr Can Do

- **Work with your computer** — read, create, and edit files; apply precise patches; and run commands or long-lived processes.
- **Understand more than text** — accept image and PDF attachments, transcribe speech, and read responses aloud.
- **Research and browse** — search the web, fetch pages, and automate browser interactions when a task requires them.
- **Create media** — generate images, videos, music, and sound effects with your selected providers and models.
- **Use your preferred AI providers** — configure your own API keys and select models separately for chat, speech, image, video, and audio.
- **Extend the agent** — import reusable skills, connect remote HTTP or local stdio MCP servers, and delegate independent work to subagents.
- **Automate routines** — create recurring schedules and periodic checklist-based health runs.
- **Remember useful context** — maintain durable memory, personalization files, conversation history, and a local working directory.
- **Compile persistent knowledge** — archive immutable evidence, incrementally maintain a cited Markdown wiki, query it before raw sources, and review risky changes.
- **Chat from other apps** — connect Telegram to reach Kucedr away from the desktop app.

Kucedr runs on Windows, macOS, and Linux, with English and Italian interfaces and light, dark, and system themes.

## Control and Privacy

- Provider API keys are encrypted locally when secure device storage is available. Optional key
  sync encrypts them with a separate passphrase before upload.
- Prompts, attachments, and tool data may be sent to the providers, MCP servers, websites, or messaging channels you configure.
- File writes, edits, patches, and command execution are governed by the agent permission policy.
- Tool activity is streamed into the conversation so you can follow what the agent is doing.
- Kucedr does not claim formal certification for regulated data.

## Technology

- Electron 41 and Node.js
- React 19, TypeScript, Tailwind CSS 4, and shadcn components
- Jest, Testing Library, and Playwright
- electron-vite and electron-builder

## Getting Started

Requirements: Node.js 22.19+ and npm 11.5.1+.

```bash
npm ci
npm run dev
```

The root install includes the Electron app, `@kucedr/sdk`, and `@kucedr/cli` through npm
workspaces and one lockfile.

On first launch, follow the [Start Page Flow](docs/ui/START.md) to sign in or continue local-only,
save a model-provider API key, and select the provider and model for the assistant. Search,
database, speech, and media configuration are optional and can be completed later in Settings.
Signed-in users can enable secure key sync and select folders for account-backed cloud backup from
**Settings → Cloud**.
See [Home UI](docs/ui/HOME.md) for the chat workspace's states and interactions.
See [Settings UI](docs/ui/SETTINGS.md) for configuration navigation and behavior.

For Linux environments that require Electron sandbox changes, run:

```bash
npm run dev-linux
```

### Command-line interface

The TypeScript CLI lives in `packages/cli`. It launches the desktop app, installs validated Kucedr
plugins, and includes an interactive terminal interface:

```bash
npm run cli:build
npm link ./packages/cli

kucedr
kucedr install package-one
kucedr tui
```

Inside the TUI, enter `/install package-one`. See
[`packages/cli/README.md`](packages/cli/README.md) for the command and plugin-install contracts.

## Quality Checks

Run the main local checks before submitting changes:

```bash
npm run quality:check
```

This runs the TypeScript checks, ESLint, main-process tests, and renderer tests. Run the end-to-end suite separately:

```bash
npm run test:e2e
```

## Build and Package

```bash
npm run build                # Type-check and create a production build
npm run dist:win             # Windows x64 installer and portable executable
npm run dist:win:portable    # Windows x64 portable executable only
npm run dist:mac             # macOS package for x64 and arm64
npm run dist:mac:dmg         # macOS DMG for x64 and arm64
npm run dist:linux:appimage  # Linux AppImage
npm run dist:linux:portable  # Linux AppImage and tar.gz archive
```

### Portable releases

On Windows, download `Kucedr-Portable-<version>-x64.exe` and run it directly. It temporarily
extracts its signed application files while Kucedr is running, but does not install shortcuts,
file associations, or uninstall records and does not require administrator access.

On Linux, download the AppImage, mark it executable, and launch it. If AppImage mounting or FUSE
is unavailable, extract the `.tar.gz` release and run `kucedr-desktop` from the extracted folder.
Neither option requires a package installation.

Kucedr settings, conversations, workspace files, and generated data remain under
`%USERPROFILE%\.kucedr` on Windows or `$HOME/.kucedr` on Linux. Electron runtime data remains in
`%APPDATA%\Kucedr` on Windows or `$XDG_CONFIG_HOME/Kucedr` on Linux, normally
`$HOME/.config/Kucedr`. Portable updates are manual: close Kucedr and replace the executable or
extracted application; the profile data remains in place.

Portable packaging does not bypass AppLocker, WDAC, Linux `noexec`, endpoint security, or network
policy. Protected command execution may require administrator or IT setup, and browser automation
requires an installed, permitted Google Chrome. Kucedr reports these limitations without preventing
chat and other supported features from running.

## Project Structure

- `src/main` contains the Electron main process, agent runtime, channels, model integrations, media services, transcription, IPC, and application services.
- `src/renderer/src` contains the React user interface.
- `src/preload` exposes the narrow bridge between the renderer and main process.
- `src/shared` contains cross-process types and API contracts.
- `src/main/terminal` contains the PTY lifecycle behind the typed terminal IPC API. See [Terminal IPC Architecture](docs/TERMINAL.md).
- `packages/cli` contains the publishable TypeScript command-line and terminal interface.
- `packages/sdk` contains the publishable typed client for Kucedr's local API.
- `src/main/agent` contains sessions, tools, skills, memory, schedules, health runs, sandboxing, and permission policy.
- `src/main/models` contains provider-specific model integrations. See
  [Provider Reference](docs/PROVIDERS.md) for the built-in catalog and runtime support matrix.
- `src/main/cloud` and `src/main/storage` keep account and cloud behavior behind replaceable ports.
  See [Account and Cloud Architecture](docs/CLOUD.md).

## Security

Renderer windows use sandboxing, context isolation, disabled Node integration, and web security. Preload APIs expose narrow typed IPC methods, and agent writes, edits, patches, and command execution are subject to the permission policy.

See [SECURITY.md](SECURITY.md) for the security policy and vulnerability reporting process.

## Releases

The Electron app, SDK, and CLI are versioned and deployed independently from this repository.
See [Development, Testing, and Deployment](docs/DEVELOPMENT.md) for local setup, test
commands, normal pushes, tag conventions, npm trusted publishing, desktop signing, and
recovery procedures.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, workflow, and code standards. Behavioral guidelines for AI-assisted contributions are in [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE) © 2026 Harald Bregu
