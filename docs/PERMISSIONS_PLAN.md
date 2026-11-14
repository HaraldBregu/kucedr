# Tool Permissions: Current State & Security Plan

> **Status:** analysis, 2026-11-14. No code changed.
>
> - It consolidates [PERMISSIONS_SECURITY.md](PERMISSIONS_SECURITY.md) (PS), [PERMISSIONS_FOLLOWUP.md](PERMISSIONS_FOLLOWUP.md) (FU), [PERMISSIONS_AGENTS.md](PERMISSIONS_AGENTS.md) (PA) and [SECURITY_AUDIT.md](SECURITY_AUDIT.md) (SA).
> - Every recorded finding was re-checked against today's tree, after the [TOOL_IMPLEMENTATION.md](TOOL_IMPLEMENTATION.md) fixes.
> - A fresh review added 5 new findings (N1–N5). N1 and the two code-level issues below it were re-checked by hand: wildcard approval rules, the "Ask" path skipping blocks, and open reads.
> - Paths are relative to `src/main/`.

## 1. How permissions work today

Every agent (chat, voice, tasks, health, subagents) calls `runToolCall` (`agent/runner/run_tool_call.ts`). For each call it runs these checks in order:

1. **The profile allowlist hides a tool:** `isAgentToolAllowedForProfile` (`shared/agent_tools.ts`). Tasks and health use fixed lists, and voice drops model-backed tools.
2. **The mode gate:** `extension.gate` / `allowsTool` (`agent/modes/`).
3. **Path and tool rules:** `resolveToolPermissionDetails` (`agent/permissions/resolve_tool_permission.ts`).
   - It classifies the tool as read, write or exec. Any tool that is none of these, such as web, MCP, recorders or `mdl__`, is **allowed** unless its tool setting says Ask or Deny (`:48`).
   - **Reads are allowed anywhere** unless blocked, whenever the run can ask (`:108`). That means chat, voice and health.
   - Writes and commands are allowed inside trusted locations. Outside them, interactive runs ask; unattended runs (tasks, subagents) are denied.
   - A per-tool setting of **Ask returns before any location rule is checked** (`:38`).
4. **Capability:** a missing capability means deny. `approval: true` forces a card (`run_tool_call.ts:~295`). Today that covers: camera, `update_health`, `act evaluate`, MCP `require_approval: always`.
5. **The approval card:**
   - Decisions are bound to window, run, tool and an input fingerprint, with a 120 s expiry.
   - "Always allow" stores a recursive rule for each approval target (`addPermissionRule`, `recursivePermissionRule`), unless `isBroadTarget` says the target is too broad.
6. **Execution:**
   - `write`/`edit`/`patch`/`undo`/`redo` re-check the grant at write time (dev/ino, no symlinks, `O_NOFOLLOW`).
   - `bash` runs in the OS sandbox using the profile's rules, plus roots approved for that one call.

**What is solid and should stay:** deny wins over allow, TOCTOU-safe file writes, the approval fingerprint, "no capability means deny", realpath plus case folding on macOS, sandboxed `bash` with a filtered environment, the `env` field refused for host commands, and approve-once only for broad targets and app data.

## 2. Findings that are open now

### Critical and High

| # | Finding | Evidence | Fix |
|---|---|---|---|
| **N1** ✔ | **Wildcards in approval targets become permanent broad rules.** `recursivePermissionRule` adds `/**` without escaping, and `isBroadTarget` compares plain strings. An injected `bash additionalRoots:["~/*"]` shows `/Users/me/*` and offers **Always allow**. The stored rule `/Users/me/*/**` matches `~/Library/LaunchAgents/…` and `~/.ssh/…`, so it means silent write and exec access across home, for files and the sandbox. The Settings UI rejects `*?[]` (`ipc/agent.ts:1113`), but the approval path doesn't check. | `agent/permissions/recursive_permission_rule.ts:3-8`; `broad.ts:9-17`; `command.ts:36-40`; checked with `path.matchesGlob` | Reject approval targets containing `* ? [ ] { }` at resolution: deny for commands, and never persist. |
| **PA#1** ✔ | **A tool set to "Ask" skips blocked locations.** It returns `ask` with empty targets, so after "Allow once" the call runs even inside a blocked folder. | `resolve_tool_permission.ts:38-47` | Compute targets and the deny check first; the Ask setting only changes allow into ask. |
| **SA#1** | **Privileged IPC is granted by app folder name.** The `coder`/`workspace` IPC trusts an app id that is just its folder name. The coder shell gets the full `process.env`. | `ipc/coder.ts:35`; `ipc/core/agent_renderer.ts:28`; `apps/app_list.ts:35`; `coding/shell.ts:12` | Bind it to the bundled app's install path or signature, and filter the env with `commandEnvironment()`. |
| **PS#4 / PA#3 / SA#6** ✔ | **Reads are open everywhere and the network is open, so anything can be exfiltrated.** No default read-deny list exists for credentials (`~/.ssh`, `~/.aws`, `~/.config/gh`, keychains, `~/.kucedr` provider stores). Tasks can still read anything through `bash cat`, and the sandbox allows every domain. | `resolve_tool_permission.ts:108`; `with_default_permissions.ts:10`; `agent/sandbox.ts:266,272` | Add a built-in **protected read list** (deny, not shown as removable) shared by the file tools and the sandbox's `denyRead`. Leave the network open, but see P2. |
| **SA#2 / SA#3** | **Plugins and MCP servers are enabled just by being on disk.** A user plugin with a higher version replaces a bundled id (e.g. `openai`), and MCP servers start at backfill unless explicitly disabled. | `plugins/plugins_dirs.ts:16`; `plugins_scan.ts:33-38`; `mcp/mcp_catalog_backfill.ts:13` | Install records (enabled only when the user enabled it), and bundled ids reserved. |
| **PS#2** | **The agent can change its own config.** Writes inside app data are approve-once, but not blocked. The "Ask" path (PA#1) bypasses even that. | `broad.ts:16` | Put app data in the protected list as **deny for write**. Settings go through IPC, not files. |

### Medium

| # | Finding | Evidence | Fix |
|---|---|---|---|
| **N2** | **macOS firmlink alias bypasses deny rules.** `/System/Volumes/Data/Users/me/.ssh/id_rsa` doesn't match `~/.ssh/**`, so it's a silent read. "Always allow" on a write there persists `/System/Volumes/Data/Users/me/**`, which `isBroadTarget` misses. The `bash` sandbox is unaffected. | `shared/real_path.ts:15`; `permission_for.ts:22-30` | In `realPath` on darwin, strip `/System/Volumes/Data` when dev/ino match. |
| **PS#7 / SA#10** | **The microphone and full-screen recorders need no approval;** only the camera does. | `agent/execution/capability.ts:53` | `approval: true` for `microphone_recorder` and `screen_recorder`. |
| **PS#7 / SA#16** | **`update_soul`/`update_user`/`update_identity` are always allowed,** so a prompt injection can rewrite the persona and user profile. | `capability.ts:26-34` | `approval: true` (same as `update_health`). |
| **N5** | **`mdl__` tools (paid, external) default to allow and can't be set to Ask or Deny.** They have no policy, and `setToolProfileTool` rejects them. | `tools/model/tools.ts:31`; `agent_store.ts:200` | Give them a policy like MCP's, defaulting to `ask`. |
| **SA#7** | **Voice runs side-effect tools without asking:** the voice profile defaults to allow. | `realtime_voice/tool_runtime.ts:190` | Voice defaults to Ask for write/exec/persist (Decision). |
| **SA#14** | **MCP `readOnlyHint` is trusted, and the decision isn't reset** when a tool's definition changes. | `mcp/mcp_tool_permission.ts:12` | Reset the stored permission when the catalog hash changes. |
| **SA#12** | **`AppIpc` handlers have no caller check.** | `ipc/app.ts:493+` | Use `TrustedRenderer` as voice does. |
| **SA#17 / SA#18** | **Cloud restore can plant code; there are no Electron fuses; the entitlements allow library injection.** | `storage/storage_protected.ts`; `resources/entitlements.mac.plist`; `electron-builder.json` | Protect `plugins/` and `skills/` from restore; enable fuses (`RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off, asar integrity). |
| **PA#2** | **Locations are kept per agent;** health has no Permissions page, and the Windows sandbox uses chat's rules. | `agent_store.ts:219` | One shared location list (PA#2A). |

### Low

| # | Finding | Evidence |
|---|---|---|
| **N3** | **The approval card truncates silently:** 50 array items, 100 keys, depth 6, with no indicator, while execution and the fingerprint use the full input. A message to 60 recipients shows 50. | `redact_approval_input.ts:7-8` |
| **N4** | **Media output re-resolves its directory by path at write time,** without no-follow checks, so a symlink swap during a slow generation can redirect it. Impact is limited (random name, content not chosen by the attacker). | `shared/media.ts:14-18` |
| PS#8 | Redaction replaces values by key name, so the user can't see what is approved. | `redact_approval_input.ts:6` |
| PA#5 | "Trust this location" stores one kind only. | `run_tool_call.ts:360-367` |
| PA#7 | Two mechanisms handle unattended runs: the tasks fallback and `filterProfileTools`. | `run_tool_call.ts:88`; `run_tools.ts:22` |
| PA#8 | Reset on the Permissions page also clears the Tools settings. | `agent_store.ts:269-274` |
| SA#19, 21, 22, 24, 25 | Catalog checksum and extract caps; the interactive browser reaching private hosts; no cron frequency cap; CSP `unsafe-inline` and `local-resource://` serving any path; updater settings. | see SA |

**Fixed or obsolete since the docs were written:** PS#1, PS#3, PS#5, PS#6, PS#8 (MCP default), FU#1–3 and #5, PA#4 (media reads, fixed today), PA#6, SA#4, SA#5, SA#9, SA#11 (obsolete), SA#13, SA#15, SA#20, SA#23, SA#26.

## 3. Root causes

The findings cluster around five structural weaknesses:

1. **Rules are glob strings with three dialects.** Stored rules, approval-generated rules, `path.matchesGlob` (which expands `{}`), the sandbox's `globToRegex` and the UI validator each read a rule differently. That causes N1 and the mismatch between the file tools and the sandbox.
2. **Path identity is a string.** Firmlinks, case and hard links are compared as strings, which causes N2 and the gaps in `isBroadTarget`.
3. **There is no protected set.** Credentials and the app's own config are only protected if the user adds a deny rule. That causes PS#2, PS#4 and SA#6.
4. **The decision is computed in six places:** the resolver, the sandbox config, `inlineFiles`, `filterProfileTools`, the profile allowlist and the mode gate. Each has its own inputs, and drift between them keeps producing bypasses (PA#1, PA#7).
5. **"Not a path tool" means allow.** Web, MCP, recorders, profile writes and `mdl__` are allowed unless someone remembered to add an approval. A sensitive tool should ask by default.

## 4. Plan

The steps are ordered by risk reduced per line of code. Steps 1–2 are small and local; step 3 is the structural fix.

### Step 1: Close the holes (small, one PR)

1. **N1:** in `resolveToolPermissionDetails` and `resolveCommandPermission`, any target with glob metacharacters gives `deny` and is never persistable. `recursivePermissionRule` asserts that it receives a literal path.
2. **PA#1:** move the tool-setting Ask check after the target and deny evaluation, so a block always wins.
3. **Built-in protected list** (one const, used by `permissionFor` and by the sandbox's `denyRead`/`denyWrite`):
   - **read and write:** `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.config/gh`, `~/.netrc`, `~/Library/Keychains`, `~/Library/Cookies`, browser profile folders, the app's provider and secret stores.
   - **write only:** app data outside the workspace (settings, plugins, skills, MCP config), `~/Library/LaunchAgents`, shell rc files.
   - It is not removable in Settings. Show it read-only.
4. **Approval by default for sensitive tools:** mic and screen recorders, `update_soul`/`update_user`/`update_identity`, and `mdl__` tools (with a configurable policy, default Ask).
5. **N2:** strip the darwin firmlink prefix in `realPath`.

→ verify, with a script that bundles the real modules (as the reviews did):
- `additionalRoots:["~/*"]` is denied.
- An "Ask" tool writing into a blocked folder is denied after "Allow once".
- `read ~/.ssh/id_rsa` and `bash cat ~/.ssh/id_rsa` (sandboxed) are both denied.
- The `/System/Volumes/Data/...` alias is denied.
- Each listed tool shows a card in chat and is hidden in the tasks profile.

### Step 2: Trust boundaries outside the tool loop

1. **SA#1:** bind the privileged app IPC to the bundled app identity, and filter the coder shell's env.
2. **SA#2/#3:** add install records for plugins and MCP servers (off until the user enables them) and reserve bundled ids.
3. **SA#12:** add `TrustedRenderer` checks to `AppIpc`.
4. **SA#14:** reset an MCP tool's permission when its definition hash changes.
5. **N3:** the approval card shows "+N more" wherever input is truncated; if it can't render the full input, it shows a warning.

### Implementation status (2026-11-15)

Steps 1 and 2 are done. Both typechecks are clean, apart from the `hideIcons` error in `Group.tsx`, which isn't ours. No tests were run. Harness checks bundled the real modules, and real macOS sandbox runs refused `ls ~/.ssh` and writes to app settings, while workspace writes worked.

- **Step 1**
  - **N1:**
    - An `ask` result whose approval targets contain `* ? [ ] { }` becomes a non-persistable `deny` (`resolve_tool_permission.ts:39`).
    - `recursivePermissionRule` throws on a glob.
  - **PA#1:** the location logic moved to `permissions/location.ts`. Deny and protected checks run first, and a tool set to Ask only turns `allow` into `ask`. This covers `bash` too.
  - **Protected list** (`permissions/protected.ts`, `protected_target.ts`):
    - **Read and write denied:** credentials (`~/.ssh`, `.aws`, `.gnupg`, `.config/gh`, `.netrc`, docker, kube), browser profiles, Keychains, Cookies, and the app's secret stores (`providers/`, `mcp/`, `credentials/`, `coder/credentials.json`, `settings/account.json`, legacy vault files).
    - **Write denied:** the user-data folder except the workspace, library and task store; LaunchAgents; shell rc files.
    - Applied in the resolver and in the sandbox's `denyRead`/`denyWrite`. The sandbox denies each existing child of the user-data folder, because its `denyWrite` beats `allowWrite`.
  - **Approval by default:**
    - All three recorders.
    - `update_identity`/`update_soul`/`update_user` once the profile exists, so first-run onboarding writes don't ask.
    - `mdl__` tools default to Ask and are configurable under Settings → Tools (chat).
  - **N2:** the darwin firmlink prefix is stripped in `realPath`.
- **Step 2**
  - **SA#1:**
    - Privileged `coder`/`workspace` IPC requires an app from the bundled plugins root (`apps/app_bundled.ts`). No bundled app uses these ids today, so no app view gets them.
    - The coder shell uses `commandEnvironment()`.
  - **SA#2/#3:**
    - Bundled plugin ids are reserved, both at scan and at install.
    - User plugins are off until enabled (an `enabled` list in the plugins store). Plugin MCP servers were already off until saved.
    - Catalog "updates" for built-in plugins were removed.
  - **SA#12:** every `AppIpc` handler with side effects goes through `TrustedRenderer`.
  - **SA#14:** stored MCP tool permissions carry a definition hash and fall back to the default when the definition changes.
  - **N3:** the approval card shows `… +N more` and depth markers.

**Behaviour changes users will notice**
- On other installs, user-installed plugins turn off after the upgrade until they're re-enabled.
- MCP permissions saved before this change revert to their default once.
- The agent can no longer write into `~/.kucedr/skills`, `plugins` or `settings`.
- The coder shell no longer sees variables exported only in the shell that launched the app.

**Remaining gaps**
- Hand-written `~/.kucedr/mcp/servers/<id>/mcp.json` still auto-starts, which needs an install record in `mcp_store_state.ts`. A write there is now denied for the agent.
- The protected list isn't shown in Settings.
- The sandbox's write deny for user data covers only the children that exist when each command runs.
- Onboarding detection for the profile tools is approximate. A clean version needs a small change in `run_stream.ts`.

### Step 3: One resolver, literal rules (structural, medium refactor)

This merges PA's "simpler shape" with the root causes above.

- **Rules are `{ root: string, recursive: boolean, kind, mode }`** with no globs. The Settings UI already forbids them. Migrate existing glob rules to their literal root, and drop any that can't be migrated, with a notice.
- **Paths are identified by realpath plus the dev/ino of the nearest existing ancestor.** `isBroadTarget` and deny matching use it.
- **Each tool declares `access(input) → { read?, write?, exec?, network?, managed? }`** next to `capability`.
- **One resolver with no tool names**, used by the runner, the sandbox config, `inlineFiles` and the profile filter. Its order:
  1. protected → deny
  2. blocked → deny
  3. tool Off → deny
  4. tool Ask or sensitive → ask
  5. trusted or managed → allow
  6. otherwise: ask when interactive, deny when unattended
- **One location list shared by every agent** (PA#2A). Profiles differ only in tool on/off/ask.

This deletes about four files in `permissions/` and the name lists in six places. Start it after steps 1–2 ship.

### Not doing now (Decisions)

- **A network allow-list for the agent.** It breaks browsing; the protected read list addresses the exfiltration risk more cheaply.
- **Voice asking for every side effect (SA#7).** Real-time voice with cards is a product decision.
- **Coder following these rules (PA#10).** Codex has its own sandbox and approvals.
- **Fuses and entitlements (SA#18).** Release-pipeline work; test notarization first.
