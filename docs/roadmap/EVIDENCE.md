# 25. Cases and evidence

Part of the [Roadmap](README.md). Status: proposal, written 2026-11-27 for the
[investigation desk](../mission/TARGET.md). 25.1 and 25.2 built 2026-11-27
([Target: first implementation plan](../TARGET_PLAN.md)).

What a page looked like, where it came from, when, and over which route, kept so someone else can
check it. The buyers are investigation firms, due-diligence boutiques and AML consultants
([Paying markets worldwide](../mission/MARKETS.md)).

## What exists today

- **Screenshots, PDFs and archives.** `use_web_browser` saves an element or full-page PNG, a PDF
  or an MHTML archive of the tab into the Library, with `<file>.json` beside it: final address,
  title, UTC time, route and proxy host, Privacy Mode, workspace, chat, app version and SHA-256
  (`src/main/agent/tools/web/browser/record.ts`). The requested address before redirects and the
  case folder are not recorded yet.
- **Routes.** Each pane tab knows its route (direct, private, proxy, Tor) and never falls back
  (`src/main/agent/tools/web/browser/prepare.ts`).
- **Cases.** A workspace is a picked folder with its own chats, browser sign-ins, tasks and
  permission rules ([Workspaces](WORKSPACES.md)). Memory, knowledge and the Library are shared.
- **Record.** Each chat's `run.jsonl` has one timestamped line per run event
  (`src/main/agent/session/session_append_run.ts`). With the vault on, each line is sealed on its
  own; it is not yet tamper-evident or per case.
- **Verification and writing.** Fact-check mode, the `deep-research` skill, the `docx`, `pdf` and
  `doc-coauthoring` skills, and workspace export to Markdown, HTML and PDF.

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 25.1 | Capture record | Every screenshot, PDF and archive writes a record beside the file: case, requested and final address, title, UTC time, route (and proxy host), tab, who asked (user or agent, chat), SHA-256 of the bytes | The `screenshot` and `pdf` actions in `run.ts`; the tab's route from `prepare.ts`; Node's `crypto` | S–M |
| 25.2 | Page archive | A full copy of the page (MHTML) beside the screenshot, recorded the same way | Electron's `webContents.savePage(path, 'MHTML')`; no new dependency | S |
| 25.3 | Captures in the case | Captures go into the case's folder, are listed in a Captures view for the case, open in place, and leave with the case on export or delete | 25.1; the workspace folder (10.1); delete (10.5) | M |
| 25.4 | Case log | An append-only log per case: captures, page visits, the agent's tool calls and approvals, each entry carrying the hash of the one before, so a removed or edited entry shows. Encrypted at rest; exported as JSON and readable text | `run.jsonl`; the vault ([Privacy](PRIVACY.md), 1.3) | M |
| 25.5 | Capture what the agent reads | A case setting: every page the agent snapshots or fetches also gets a capture record | 25.1; `snapshot` and `fetch_web_page` | S |
| 25.6 | Claims linked to captures | Fact-check is the case default. A claims table lists each claim of a case answer with the captures behind it; a claim with none is marked unverified | Fact-check mode; 25.1 ids | M |
| 25.7 | Evidence bundle | One export: the memo (PDF and Markdown), the evidence list (id, address, time, route, hash), the captured files, the case log and an integrity note that describes the method. Links resolve inside the bundle | Workspace export (`src/main/export.ts`); 25.1–25.4 | M |
| 25.8 | Bundle check | Recompute every hash and the log chain, in the app or from the CLI; a colleague opens the bundle in a fresh profile | `packages/cli`; 25.7 | S |
| 25.9 | Trusted timestamps | An RFC 3161 token per capture or per log head from a timestamp service the user chooses, for example a qualified eIDAS one where Italian practice expects it | 25.1, 25.4; DER encoding of the request (dependency decision) | M |
| 25.10 | Chronology and memo skill | A bundled skill that drafts a chronology or memo from the case's captures, every sentence linked to one | Bundled skills; 25.6 | S |
| 25.11 | Screening connector | Connect the firm's own screening account (for example ComplyAdvantage or OpenSanctions) so hits arrive in the case as sources | MCP connectors through plugin manifests; nothing bundled, since OpenSanctions data is CC BY-NC | M |
| 25.12 | Hostile-link mode | Send a link or file hash to the scanning service the user picked for the case (urlscan, VirusTotal), as a private scan; held downloads are hashed | Held downloads (13.11); connector manifests; [FRONTIER.md](../mission/FRONTIER.md)'s demand gate first | S–M |

## Rules the design keeps

- **Method, not admissibility.** The app and the integrity note say what was recorded and how. They
  never say "court-ready", "forensically sound" or "anonymous".
- **Evidence is not generated.** Generated images, video or sound never enter a case's evidence.
- **The record never leaves by itself.** Captures and the case log stay in the case. A scan,
  timestamp or screening request goes only to a service the user chose for that case, and the
  case log records it.
- **What the model saw.** When a hosted model is used, the case log says that page text went to
  that provider.

## Depends on

- Sealed case (10.10) and delete (10.5), so a case's captures, memory and knowledge stay in the case.
- Proxy profiles with login (12.5) and the per-case route (12.4).
- The vault covering `run.jsonl` (1.3), untrusted content marking (13.10) and signed builds (6.1).

## Open decisions

- **Hash.** Recommended: SHA-256, the standard the competitors use.
- **Capture what the agent reads (25.5).** Recommended: on by default in case workspaces, off
  elsewhere.
- **Timestamps (25.9).** Recommended: after the first paying firms, and only if calls ask for them.
- **Log format.** Recommended: one JSON line per entry with the previous entry's hash, so the
  existing run-trace tools can still read it.
