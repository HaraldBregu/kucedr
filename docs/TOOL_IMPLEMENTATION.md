# Tool Implementations: Review & Fix Plan

> **Status:** analysis, 2026-11-14. This is the third pass. [AGENT_TOOLS.md](AGENT_TOOLS.md) covered loading, discovery, execution, the prompt and subagents; this pass looks inside each built-in tool. Paths are relative to `src/main/`. Findings marked ✔ were re-checked in code by hand; the rest were verified by a reviewer reading the code, with node snippets where noted.
>
> **Rejected reviewer claim:** "`capability.ts` / `media_output_tool.ts` list deleted recorder tools". The recorder tool ids still exist; only their files were merged into `tools/system/recorder.ts`.

## 1. Fix first: security and data loss

| # | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| X1 ✔ | High | **The sandbox leaks the app's whole environment into every command** on macOS and Linux. `wrapWithSandboxArgv` returns `env: process.env`, and `Object.assign(env, wrapped.env)` writes it over the allow-list from `commandEnvironment`. Exported API keys, plus the `.env` loaded in dev, reach `env`/`printenv`. The model's own `env` values (e.g. `NODE_ENV`) are overwritten, and `NODE_OPTIONS`/`DYLD_*` come back. Elevated host mode is cleaner than the sandbox. | `agent/sandbox.ts:92`; `agent/tools/core/bash.ts:176`; `@anthropic-ai/sandbox-runtime/.../sandbox-manager.js:1481` | Take only the keys of `wrapped.env` that differ from `process.env` (the proxy variables), then apply the user's `env`. |
| X2 ✔ | High | **Media `url` inputs read any local file.** Any value that isn't http or data is read with `fs.readFile`, outside the permission system. It has no size or type check, and it is uploaded base64 to the provider. | `agent/tools/media/inline.ts:19-22` | Allow only the listed media extensions, cap the size, and resolve through `authorizeFilePath`/read permission. |
| X3 ✔ | High | **`edit` corrupts `$` sequences.** `content.replace(oldText, newText)` interprets `$$`, `$&`, `` $` `` and `$'`, so `echo $$` is saved as `echo $`. Shell scripts, regexes and templates are silently corrupted. | `agent/tools/core/edit.ts:31` | `content.slice(0, i) + newText + content.slice(i + oldText.length)` |
| X4 | High | **`patch` isn't atomic, and history is recorded only on success.** If a later hunk fails, the earlier files stay modified, and undo can't revert them. Two hunks on the same path also fail with "File changed after authorization", because each write invalidates the grant. | `agent/tools/core/patch.ts:27-47`; `agent/files/authorize.ts:17`; `runner/run_tool_call.ts` (history on settle) | Apply all hunks in memory and group them by path, then write. |
| X5 ✔ | Med | **Writes drop file modes.** The temp file is opened `0600` and renamed over the target, so edited scripts lose `+x` and new files come out `0600`. | `agent/files/write.ts:16,24` | `fchmod` the temp file to the existing mode, or `0666 & ~umask` for new files. |
| X6 | Med | **The background browser can reach private addresses without approval.** A page that injects instructions can steer an unattended task to `169.254.169.254` or a LAN admin page. | `agent/tools/web/use_web_browser.ts:115-121`; `browser/background.ts:17` | Apply `publicUrl` to navigation in background sessions. |
| X7 | Med | **`update_health` writes the prompt that runs unattended every 30 min**, and the health run has no deny list. A prompt-injected turn could keep itself running. (Scheduled task runs can't call it: the tasks profile omits it.) | `agent/tools/health/update.ts:15`; `health/run.ts:35`; `agent/agent.ts:97,152` | Deny `update_health` in the health run itself, and give it `approval: true`. |
| X8 | Med | **Paid calls are retried silently.** The OpenAI SDK's default `maxRetries: 2` applies to `mdl__` POSTs and `images.generate`, so up to 3 charges are counted as 1. `create_image count: 8` is 8 generations counted as 1 paid call, and a failure partway drops the images already saved. | `agent/tools/model/tools.ts:40`; `models/adapters/tti/tti_sdk.ts:8`; `agent/tools/media/create_image.ts:36-47` | Set `maxRetries: 0`, charge `paid` per `count`, and return partial results. |
| X9 | Med | **`act kind:"evaluate"` runs any JS in the logged-in browser profile** but is classed as `external`, the same as a click. | `agent/execution/capability.ts:61-68` | Class it as `execute`, with `approval: true` in the interactive profile. |

## 2. Correctness

**File tools**
- **Large files**
  - A successful write over 2 MB is reported as an error with no history, because the after-capture throws (`history/capture.ts:8`).
  - `read` with `offset` on a file over 2 MB throws before the offset applies, even though the description recommends offset for large files (`read.ts:13,22`).
- **Text encoding**
  - CRLF files:
    - `edit` never matches multiline LF `oldText` (`edit.ts:23`).
    - `patch` writes LF into CRLF files (`patch/update.ts`, `sequence.ts:14`).
  - `patch` loses a trailing blank line (`patch/update.ts:6,47`) and always adds a final newline.
  - Non-UTF-8 and binary bytes become U+FFFD, and `edit` writes the whole file back, so the damage spreads past the edit (`edit.ts:22`, `read.ts:22`). Reject with `!isUtf8(buf)`.
- **Undo**
  - A multi-file undo isn't transactional. A partial failure leaves the state `applied`, so every later undo fails (`history/restore.ts:13-46`).
  - `restore` truncates in place instead of writing a temp file and renaming (`restore.ts:43`).

**Shell**
- **Lifecycle**
  - Elevated and background children aren't tracked or killed on quit or on `deleteSession`.
  - Registry entries are never pruned (`bash.ts:184-243`, `process.ts:20-61`).
- **Output**
  - `poll` returns the oldest 500 KB of output, which `limitToolOutput` then cuts to its head. A chatty server never shows its newest lines (`process.ts:203-210`). Return the tail, or only the output since the last poll.
  - Each stream cap (200k characters) equals the tool cap, so `stderr`/`timedOut` fall off the end of the JSON (`bash.ts:254`). Cap each stream at about 90 KB and keep the tail.
- **Foreground stdin**
  - It's an open pipe, so `rg foo`/`sort` with no path hang until the 60 s timeout.
  - Chunks are decoded one by one with `toString()`, which splits UTF-8 characters (`bash.ts:245,261-278`).
- **Linux:** read-only commands call `cleanupAfterCommand()` and can unlink a running bwrap's mount points (`sandbox.ts:123-131`).
- **Smaller issues**
  - `timedOut` is never set after a yield (`bash.ts:350`).
  - Writes to an exited session report success (`process.ts:225-264`).
  - `pty:true` fails on Windows (`bash.ts:142`).

**Web**
- **Browser**
  - ✔ Snapshot refs are never cleared, so a second snapshot hands out duplicate `eN` refs and `click e3` hits two elements (`use_web_browser.ts:130-144`). Remove every existing `data-agent-ref` first.
  - ✔ `pdf` always fails in chat: `page.pdf()` is headless-only, and the chat browser is headed (`use_web_browser.ts:374`).
  - All foreground chats share one browser, and `targetId` defaults to the most recent tab, so chat A can act in chat B's tab (`use_web_browser.ts:103-112`).
  - A failed `goto` leaves its tab open (`use_web_browser.ts:309`).
- **`fetch_web_page`**
  - Bodies over 1 MB throw instead of being truncated (`body.ts:10`).
  - The content type and `charset` are ignored, so PDFs come back as garbage (`fetch_web_page.ts:76-88`).
  - HTML entities are decoded twice, and numeric entities not at all (`:20`).
- **Smaller issues**
  - The search provider has no timeout (`search/search_web.ts:40`).
  - `[ipv6]` literal hosts fail the lookup (`public.ts:18`).
  - Search API keys are sent to the renderer (`search_get_providers.ts:22`).
  - The blocklist misses NAT64, 6to4 and `198.18/15`.
- **Untrusted text:** web text, snapshots and search results reach the model unmarked. Wrap them in a delimited untrusted field.

**Media, tasks, recorder**
- **Recorder**
  - `wait:true` ignores abort and has no cap (`tools/system/recorder.ts:115`).
  - A start reports "recording" even when the filename already exists, and the error only shows later (`:84`).
- **Video:** downloads are unbounded and buffered about 3–4×, and polling ignores abort for up to 5 s (`models/adapters/ttv/ttv_shared.ts`).
- **Tasks:** deleting or disabling a task doesn't stop its current run (`tasks/tasks_delete_schedule.ts:4`).
- **Profile tools:** the profile `update_*` tools replace whole records with no version check, so concurrent Settings edits are lost.

## 3. Dead code and simplification

- **`bash`:** the `host` gateway/node branches and the `security`/`node` schema fields do nothing (`bash.ts:80-90`). The PTY argv is built twice.
- **`readonly.ts:19`:** the third regex alternative can never match, and `startsWith('..')` rejects folders named `..cache`.
- **File helpers**
  - `files/remove.ts:8` re-validates after authorizing.
  - The chunked read loop is duplicated in `files/read.ts` and `read_sync.ts`.
  - The 2 MB literal appears 4× in `history/`; use `MAX_READ_BYTES`.
- **Tasks:** `createTaskRequestSchema.enabled` is always overwritten with `false`, so the input is misleading.
- **Small items**
  - `recordingOwners` is never pruned.
  - `mdl__` builds a client on every call.
  - The `use_web_browser` snapshot is still pretty-printed.

## 4. Plan

Ordered by risk. Each step stands alone.

1. **Security (X1, X2, X6, X7, X9).** Each is a small local change.
   → verify:
   - A sandboxed `env` shows only the allow-list plus the proxy variables.
   - `create_image` with `url: "~/.ssh/id_rsa"` is refused.
   - A background-run browser can't open `http://169.254.169.254`.
   - The health run can't call `update_health`.
2. **Data loss (X3, X4, X5, large writes, encoding).** Fix the `edit` slice, the in-memory atomic patch, the mode-preserving write, a non-restorable history marker instead of throwing, and the UTF-8 guard.
   → verify:
   - An edit containing `echo $$` saves `$$`.
   - A 2-hunk patch where the second hunk fails leaves both files untouched.
   - An edited `0755` script stays `0755`.
3. **Money (X8).** Set `maxRetries: 0`, charge per `count`, and return partial results.
4. **Browser correctness.** Clear snapshot refs, make `pdf` fail clearly or use a headless context in chat, close a tab whose `goto` failed, and keep tabs per run.
5. **Shell lifecycle and output.** Kill tracked sessions on quit and delete, prune finished sessions, tail-limited `poll`/stream caps, ignore stdin for foreground commands, and stream decoding.
6. **The rest of §2 and §3** as cleanup.

**Not doing:** marking untrusted web text needs a prompt-format decision first, so it's tracked here rather than designed now.
