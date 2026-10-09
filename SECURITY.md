# Security Policy

Kucedr is a desktop AI assistant that can work with local files, execute commands, and connect to
external services. This policy describes supported releases, private vulnerability reporting,
and the security boundaries in the current application.

## Supported Versions

Only the latest published desktop release receives security fixes. Older releases are unsupported;
update before checking whether an issue is already fixed.

For SDK, CLI, and bundled MCP reports, include the affected package name and version alongside the
desktop version. Find desktop builds on [GitHub Releases](https://github.com/HaraldBregu/kucedr/releases).

## Reporting a Vulnerability

Email [harald.bregu@gmail.com](mailto:harald.bregu@gmail.com). Do not disclose vulnerabilities,
credentials, or exploit details in public issues or pull requests.

Include:

- A description of the issue, impact, and affected security boundary.
- Desktop or package version, operating system, and relevant configuration.
- Minimal reproduction steps or a proof of concept using disposable data.
- Redacted logs or screenshots, if needed to demonstrate the result.
- Whether the issue is reproducible on the latest release.

Do not send live API keys, tokens, or private documents. The maintainer will review the report,
request additional details if needed, and coordinate a fix and disclosure. Please allow time for
that process before publishing exploit details.

## Scope

Reports about these repository components are in scope:

- Electron sandbox, context isolation, navigation, preload, or IPC bypasses.
- Unauthorized file access, path traversal, command execution, or permission bypasses.
- Exposure or unauthorized use of provider credentials, MCP OAuth tokens, channel tokens, or account sessions.
- Cross-app access to another app's data or privileged Coder and terminal APIs.
- Unauthorized remote-agent or channel access, including allowlist bypasses.
- Exposure of conversations, memory, Library files, Workspace data, or synchronized content.
- Vulnerabilities in the SDK, CLI plugin handling, bundled MCP servers, or checked-in backend functions.

For issues in an external provider or MCP service, report to that service as well. Include how
Kucedr contributes to the issue when reporting it here.

## Credential Handling

Credentials do not all use the same storage mechanism:

| Data                                            | Current behavior                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Model, database, and search API keys            | Stored in plaintext in local provider settings under `~/.kucedr/providers/settings.json`                    |
| Storage provider secret keys                    | Encrypted with Electron `safeStorage`; saving or opening them requires secure storage availability          |
| MCP secrets and local-server environment values | Encrypted with `safeStorage` when available; otherwise retained in memory                                   |
| Channel tokens                                  | Encrypted with `safeStorage` when available; otherwise retained in memory                                   |
| Account sessions                                | Encrypted when secure storage is available; fall back to memory when it is unavailable or persistence fails |

The secure-storage availability check rejects Linux's `basic_text` backend. Memory-only secrets
are not retained across app restarts. These protections depend on the operating system and do not
protect against a compromised desktop account.

Conversations, memory, settings, and workspace files are local data, not an encrypted vault.
Protect the Kucedr profile, exported files, and backups accordingly. Do not include secrets in
app-store JSON values, prompts, shared logs, or committed MCP manifests.

## Execution and Integration Boundaries

- Renderer windows created by `WindowFactory` use sandboxing, context isolation, disabled Node
  integration, and web security. Preload exposes typed IPC methods; privileged handlers validate callers.
- Agent reads, writes, edits, patches, and commands follow configured tool and directory permissions.
  Trusted locations, prior authorization, or explicit allow rules can permit actions without another prompt.
- Actions that resolve to `ask` are denied when a run has no interactive window. This does not prevent
  background tasks from using actions already allowed by their configuration.
- MCP approval follows each server's settings. Local stdio servers run as local processes, and remote
  servers receive data supplied to their tools. Review servers and their approval settings before enabling them.
- Channel access follows configured direct-message policies and group allowlists. An open direct-message
  policy permits any sender; choose the access policy appropriate for your account.
- Coder tools and native terminal processes can execute with the desktop user's authority. A project
  working directory is not a security sandbox. See the [SDK boundaries](packages/sdk/README.md#whats-available).

The renderer sandbox does not isolate every agent tool, installed app API, or local connector from
the rest of the machine. Install trusted extensions and review permissions before enabling automation.

## Data Sent to Services

Local use does not require a Kucedr account. External model requests, embeddings, MCP calls,
web browsing, and messaging can send task inputs or results to the configured services.
Their retention and processing policies apply to that data.

Folder backup and version history sync upload selected content to configured storage. Version sync
also sends saved S3 credentials to the authenticated backend registration function for encrypted
server storage. See [Cloud file synchronization](docs/STORAGE_SYNC.md) for the deployment and data flow.

Kucedr does not claim formal certification for regulated data. See the
[application guide](docs/APPLICATION.md) and [contribution requirements](CONTRIBUTING.md#security-requirements)
for related workflows.
