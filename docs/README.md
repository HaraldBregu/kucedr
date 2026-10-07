# Kucedr documentation

Start here for the desktop application, its bundled apps, integrations, and development workflow.
These guides describe the checked-in implementation; provider availability and operating-system permissions can affect what runs on a particular device.

## Use Kucedr

- [Application guide](APPLICATION.md): first launch, conversations, voice, media, automation, knowledge, integrations, backup, and troubleshooting.
- [Apps guide](APPS.md): installable app windows, external development folders, app data, and the built-in Workspace.
- [Feature reference](FEATURES.md): detailed capabilities and implementation limits.
- [Provider reference](PROVIDERS.md): model and service catalogs and supported runtime adapters.
- [Use-case tests](use-cases/README.md): copyable scenarios and pass checks for chat, media, web, local work, automation, and Google MCP services.

## Understand the interface

- [Start page](ui/START.md): optional account sign-in, provider credentials, and required assistant selection.
- [Home](ui/HOME.md): chat, attachments, tool activity, sessions, and voice interactions.
- [Settings](ui/SETTINGS.md): configuration pages, Library, Memory, Workspace, persistence, and navigation.

## Build and extend

- [Architecture](ARCHITECTURE.md): process boundaries, runtime flow, persistence, and source map.
- [Development](DEVELOPMENT.md): setup, checks, builds, CI, and deployment.
- [Gmail MCP tool tests](GMAIL.md): prompts for exercising all 23 Gmail tools in a recorded chat.
- [Google Calendar MCP tool tests](CALENDAR.md): prompts for exercising all nine Calendar tools in a recorded chat.
- [Google Drive MCP tool tests](DRIVE.md): prompts for exercising all eight Drive tools in a recorded chat.
- [Plugins](PLUGINS.md): package skills, MCP servers, apps, and providers.
- [SDK](../packages/sdk/README.md): embedded app bridge and optional HTTP client contract.
- [CLI](../packages/cli/README.md): desktop launch, plugin installation, and terminal interface.
- [Terminal](TERMINAL.md): native terminal lifecycle and IPC.
- [Contributing](../CONTRIBUTING.md): repository workflow and contribution rules.

## Operate and maintain

- [Account and cloud architecture](CLOUD.md): authentication, storage boundaries, and current limitations.
- [Cloud file synchronization design](STORAGE_SYNC.md): local durability, version metadata, service setup, and recovery.
- [Supabase](SUPABASE.md): account infrastructure and local backend setup.
- [Releasing](RELEASING.md): release entry point and deployment references.
- [Security](../SECURITY.md): security policy and vulnerability reporting.
- [Agent review](AGENT_REVIEW.md): engineering review of the agent runtime; consult current source before treating findings as current defects.
- [Landing page](LANDING_PAGE.md): product website design brief; verify proposed claims against the current application guide.

## Keep documentation current

Update the relevant guide with a behavior change. Verify visible labels and routes against the renderer, runtime claims against the main process, and commands against `package.json`. Link to specialist references instead of copying their configuration tables. Check relative links and format changed Markdown with the repository's Prettier installation.
