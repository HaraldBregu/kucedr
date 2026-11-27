# Target: first implementation plan

Status: steps 1–3 built 2026-11-27 and checked in the built app with a mock model and a local
page (see [What was checked](#what-was-checked)). It picks the code work from
[Target](mission/TARGET.md) that can start now, before the phase 0 buyer test, and plans it step by
step. Statements about the code come from a read of `dev` on that date.

## What starts now and why

TARGET.md says phase 0 needs no code and phase 2 waits for a pass. Two pieces are worth building
either way:

1. **Capture record and page archive (25.1, 25.2).** TARGET.md keeps 25.1 in the free core even if
   phase 0 fails, and the phase 0 demo is stronger with a real record than a mock.
2. **Encryption on (gate 2, 1.3).** The vault covering `run.jsonl` and on by default for new
   installs. Every direction needs it.

Not in this plan:

| Item | Why not here |
| --- | --- |
| Signed builds (gate 1, 6.1) | Paperwork first: legal entity, Apple Developer ID, Windows organisation signing |
| Local knowledge (gate 3, 15.3) | Needs a dependency decision for the local embedding model; its own plan |
| Routes proven, local run (gates 4, 5) | Manual checks, recorded in [BROWSER_ROUTES.md](BROWSER_ROUTES.md) when run |
| Security items (13.10, 21.x) | Already planned in [SECURITY_AUDIT.md](SECURITY_AUDIT.md) |
| 25.3 onward, 10.10, 12.4, 12.5 | Phase 2, only on a phase 0 pass |

## Step 1: capture record (25.1)

### Today

`use_web_browser` actions `screenshot` and `pdf` (`src/main/agent/tools/web/browser/run.ts`, lines
188–219) call `saveMedia` (`src/main/shared/media.ts`), which writes
`browser-<ms>-<uuid>.<ext>` into the workspace Library (`mediaDirectory`) or a given directory, and
return `{ targetId, path }`.

### Change

Beside every capture file, write `<file>.json`:

```json
{
  "id": "<uuid from the file name>",
  "file": "browser-….png",
  "sha256": "<hex of the bytes written>",
  "kind": "screenshot | screenshot-element | screenshot-full | pdf | archive",
  "url": "<webContents.getURL() at capture time>",
  "title": "<webContents.getTitle()>",
  "time": "<UTC ISO 8601>",
  "route": "direct | private | proxy | tor",
  "proxy": "<host:port, only for proxy and tor, from connections()>",
  "privacyMode": true,
  "workspace": "<workspace id>",
  "chat": "<session id from executionScope, if any>",
  "by": "agent",
  "app": "<app version>"
}
```

- **Where:** one new file `src/main/agent/tools/web/browser/record.ts` with one function
  `record(tab, file, bytes, kind)`. It hashes with Node's `crypto.createHash('sha256')` over the
  same buffer `saveMedia` wrote, so the hash matches the file without a re-read.
- **`saveMedia`** returns the path today; it needs to hand back the buffer too, or `run.ts` decodes
  the base64 once and passes bytes in. Recommended: `run.ts` decodes once and both calls take the
  `Buffer`; `saveMedia`'s other callers keep their base64 signature through a thin overload only if
  there are several of them (check callers first).
- **Tool result:** add `sha256` and `record` (the JSON path) to the returned object, so the agent can
  cite a capture by id.
- **Route** is `tab.route` (`pane.ts`); `privacyMode` from `isPrivacyEnabled()`, since Privacy Mode
  routes direct tabs too (`prepare.ts`).
- **Who asked** is always `agent` today: there is no user-facing capture button. A user button is
  out of scope; the field is there so one can be added.
- **Requested address** (before redirects) is left out. Electron's navigation entries expose only
  the final `url`; recording the chain needs a `did-redirect-navigation` listener per tab. Add it
  with 25.4, where page visits are logged anyway.

### Verify

- Drive `use_web_browser` in the built app with a mock model: screenshot, full page, element and PDF on a direct and a proxy tab.
- For each, `shasum -a 256 <file>` equals the record's `sha256`; `route` and `url` match the tab.
- `npm run typecheck`.

Size: S.

## Step 2: page archive (25.2)

- New action `archive` in `BrowserRun`, calling
  `tab.view.webContents.savePage(path, 'MHTML')` into the same directory with the same naming, then
  `record(…, 'archive')`. Hash is computed by reading the written file (savePage writes it itself).
- The tool description in the plugin manifest gains the action; no provider code in `src`.
- **Open check from TARGET.md:** whether MHTML keeps images, styles and iframes. Verify on three
  real pages (a news article, a social profile, a page with an iframe) by opening the `.mhtml` in a
  fresh Chromium profile with the network off.

Size: S.

## Step 3: `run.jsonl` under the vault (1.3)

### Today

`appendRun` (`src/main/agent/session/session_append_run.ts`) buffers lines and appends plain text.
`vault/convert.ts` skips `run.jsonl` because whole-file AES-GCM (`seal`) cannot be appended to.
Readers: `insights.ts`, `spend_report.ts`, `session_watch.ts`, `session_list_sessions.ts`,
`session_clear_messages_by_session_id.ts`.

### Change

- **Seal per line.** When the vault is on, each line is written as `v1:<base64(seal(line))>`. A
  plain JSON line starts with `{`, so the two never collide and a file can mix both after the vault
  is turned on mid-chat.
- One new reader `src/main/agent/session/session_read_run.ts` that returns the parsed entries,
  unsealing `v1:` lines and passing `{` lines through. Every reader above switches to it.
- `vault/convert.ts` stops skipping `run.jsonl` and rewrites it line by line in both directions.
- Per-line GCM grows each line by about 40 bytes plus a third for base64; trace files stay small.

### Vault on by default

- `vault/state.ts` already treats a saved file without `enabled: false` as on. For a new install
  (no state file, no sessions folder), write `{ enabled: true }` on first start when
  `safeStorage` is available; existing installs keep what they have.
- The Privacy centre states it; nothing else in the UI changes.

### Verify

- With the vault on, a mock-provider chat leaves only `v1:` lines in `run.jsonl`; Run insights and
  the spend report still show the run.
- Turn the vault off and on: the file converts both ways and stays readable.
- A fresh profile starts with the vault on; an existing profile with it off stays off.

Size: S–M.

## Order and size

| Step | Work | Size |
| --- | --- | --- |
| 1 | Capture record beside screenshots and PDFs | S |
| 2 | MHTML page archive with record | S |
| 3 | `run.jsonl` sealed per line; vault on for new installs | S–M |

Steps 1 and 2 are one track; step 3 is independent and can run in parallel.

## Decisions

- **Record beside the file or in a log.** Recommended: beside the file now. The chained case log
  (25.4) later collects the same records; a sidecar survives a copy of the file on its own.
- **Captures stay in the Library for now.** Moving them into the case folder is 25.3 and depends on
  10.10 and 10.5 (phase 2).
- **No new dependencies, tests or migrations.** Saved data is upgraded when read (mixed `run.jsonl`
  lines); nothing edits `~/.kucedr` by script.
