# 17. Integrations

Part of the [Roadmap](README.md). Status: proposal.

Connecting Google, Microsoft and other services so the agent can work with mail, calendar and files.

## What exists today

Read from the docs on 2026-11-19; the setup flows were _not verified_ in the running app.

- Google and Microsoft arrive as plugins, plus a Google Drive client (`src/main/drive/client.ts`).
- Each user must register their own developer app. Microsoft needs an Entra app registration and a
  tenant ([MICROSOFT.md](../MICROSOFT.md)); Google needs a client ID and secret in plugin settings.
- The mail tools have gaps recorded in [GMAIL.md](../GMAIL.md).
- Connector settings lack package upload and folder controls ([Settings](../ui/SETTINGS.md)).
- [CLOUD.md](../CLOUD.md) mentions messaging providers; none exists.

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 17.1 | One-click sign-in | "Connect Google" or "Connect Microsoft" with no developer setup, using an app registration Kucedr provides | The existing connector sign-in | L, needs provider verification |
| 17.2 | Complete mail tools | Read, draft, send and organise mail reliably | The Gmail connector | M |
| 17.3 | Connector management | See each connected account, what it may access, when it was last used, and disconnect it | Settings → connectors | M |
| 17.4 | Per-workspace accounts | Work and personal accounts kept apart | [Multiple workspaces](WORKSPACES.md), 10.3 | M |
| 17.5 | Messaging channels | Talk to the agent from a messaging app | Nothing today | L |

## Open decisions

- **17.1 is mostly outside the code.** Google and Microsoft review apps that ask for mail and file
  access; that takes time and a published privacy policy
  ([Distribution and trust](DISTRIBUTION.md), 6.4).
- **Sending mail** stays behind an approval by default.
- **Plugin sign-in** ([Plugins](PLUGINS.md), 8.2 and 8.3) is the mechanism; this area is the
  first-party setup on top of it.
