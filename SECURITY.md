# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x (latest release) | ✅ |
| Older releases | ❌ |

Only the latest release receives security fixes.

## Reporting a Vulnerability

Please do **not** report security vulnerabilities through public GitHub issues.

Instead, email **harald.bregu@gmail.com** with:

- A description of the vulnerability and its impact.
- Steps to reproduce (proof of concept if possible).
- The affected version, platform, and configuration.

You should receive an acknowledgment within a few days. Please allow a reasonable disclosure window for a fix to be developed and released before any public disclosure.

## Scope

Kucedr handles the following sensitive data locally on the user's machine:

- AI provider API keys
- Connector credentials (Google, Microsoft, Dropbox)
- Channel configuration and secrets (e.g. bot tokens)
- Agent conversation history and session data
- Local workspace files

Reports involving exposure, exfiltration, or unauthorized use of any of the above are in scope, as are Electron shell escapes (sandbox, context isolation, or IPC bypasses) and permission-check bypasses for tool or connector actions.

## Security Baseline

The application is built against the following hardening baseline:

- Renderer windows run with sandboxing, context isolation, disabled Node integration, and web security enabled; windows are created through `WindowFactory` to keep these defaults consistent.
- Preload APIs expose narrow, typed IPC methods only.
- Secrets are not committed, logged, rendered, or stored in plaintext where avoidable; API keys are not shown back in plain text after saving.
- Tool and connector actions that write, delete, publish, or access private data must pass explicit permission checks; non-interactive runs deny permission-requiring actions by default.
- Channels enforce per-channel access control (e.g. direct-message allowlists).

## Disclaimer

Kucedr does not currently claim any formal regulated-data certification. Data sent to third-party AI providers or connected services is governed by those providers' own terms.
