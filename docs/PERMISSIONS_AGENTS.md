# Permissions across agents — review and better solutions

Reviewed 2026-11-10 on `dev`. Scope: how chat, voice, tasks, health, subagents and Coder decide whether a tool call may run: `src/main/agent/permissions/*`, `runner/run_tool_call.ts`, `runner/run_tools.ts`, `agent_store.ts`, `agent_profiles.ts`, `sandbox.ts`, `tools/media/inline.ts`, `coding/harness/codex.ts`.

Earlier reviews: `PERMISSIONS_SECURITY.md` (findings #1–#8) and `PERMISSIONS_FOLLOWUP.md`. This document does not repeat them, except where a finding is still open.

Terms: a **trusted location** is an allow rule, a **blocked location** is a deny rule, and an **unattended run** is one with no window to show an approval card (tasks, health, subagents).

## Changed in this pass: the workspace is the only default location

Before, every agent profile trusted two folders by default: the workspace (read, write, commands) and Library (read, write). The Library rule was added again on every load and save, so the trash icon on its row in Settings → Permissions did nothing.

Now:

- The default is the workspace only, for chat, voice, tasks and health (`agent_store.ts`, `permissions/with_default_permissions.ts`).
- Profiles saved by older versions need no action. Older versions wrote the defaults into the profile file, so `settings/chat.json` and `settings/tasks.json` can still contain the Library rule. Such a list is recognised by the workspace rule saved next to it, and the Library rule in it is ignored on load (`permissions/without_default_permissions.ts`). No file is rewritten at startup; the next save stores the list in the new form.
- Defaults are no longer written to the profile file. Only rules the user added are saved, and the workspace is added on load. Reset saves an empty list.
- Library can still be trusted by hand or from an approval card ("Trust this location"), and can be removed again.
- The media output folder is not a location and did not change: media, recorder and browser screenshot/PDF tools still save to Library when no `directory` is given. It is the tools' own output folder, so it needs no location rule; a block rule on Library still stops them (`permissions/resolve_tool_permission.ts`). The chat Library panel, the image picker in the markdown editor and the Library preview all read generated media from there, and without this the first image in chat would show a card and scheduled tasks could not create media at all.

What is different for the agent:

| Action on Library | Before | Now |
| --- | --- | --- |
| Media tool with no `directory` | allowed | allowed |
| `write` / `edit` / `patch` (chat, voice) | allowed | asks, can be trusted |
| `write` / `edit` / `patch` (tasks, health, subagents) | allowed | denied until Library is trusted for that agent (health has no page for it, see finding 2) |
| `read` (chat, voice, health) | allowed | allowed (reads are open everywhere, see finding 3) |
| `read` (tasks) | allowed | denied until trusted in Tasks → Permissions |

## How each agent is checked today

All agents call the same `runToolCall`. They differ in the profile they read and in whether a card can be shown.

| Agent | Rules read from | Can show a card | Outside trusted locations | Reads |
| --- | --- | --- | --- | --- |
| Chat | chat profile | yes | asks | anywhere |
| Voice | voice profile | yes (voice window) | asks | anywhere |
| Tasks | tasks profile | no | denied | `read` tool: trusted only; commands: anywhere |
| Health | health profile (no Permissions page) | no | denied | anywhere |
| Subagent | parent's profile | no | denied | same as parent |
| Coder (Codex) | none of these | its own | Codex decides | Codex decides |

## Findings

Each one was reproduced by calling the real resolver with an isolated data folder, unless marked "by reading".

| # | Severity | Finding |
| --- | --- | --- |
| 1 | High | A tool set to "Ask" skips the location rules, including blocks |
| 2 | Medium | Blocked and trusted locations are per agent; health has no page |
| 3 | High | Reads are open everywhere; the tasks limit is bypassed by commands |
| 4 | Medium | Media tools read any local file given as an input |
| 5 | Low | "Trust this location" covers one tool kind only |
| 6 | Fixed | Defaults were saved into the profile file |
| 7 | Low | Unattended runs are handled by two different mechanisms |
| 8 | Low | Reset on the Permissions page also resets the Tools page |
| 9 | — | Still open from `PERMISSIONS_SECURITY.md`: #5, #6, #7 |
| 10 | Info | Coder does not use these rules |

### 1. A tool set to "Ask" skips the location rules

**Where:** `permissions/resolve_tool_permission.ts:37` returns `ask` as soon as the tool's setting is "Ask", before any location is looked at.

**Effect:**
- Tool `write` set to "Ask", target inside a blocked folder: a card appears with no location and the generic reason. After "Allow once" the file is written inside the blocked folder. With the tool set to "Allow" the same call is denied. The Permissions page says "Blocked locations override grants".
- A host command (`elevated: true`) shows the "outside trusted location" text instead of the host warning.
- For `bash`, the approved `additionalRoots` are not passed to the sandbox (`run_tool_call.ts:427` uses the empty target list), so the approved command still fails.

Affects any tool the user sets to "Ask" in chat or voice.

**Better:** decide by location first, then apply the tool setting on top. A block stays a block. An `allow` becomes `ask`, keeping the targets and the reason, and is not rememberable. About ten lines in the same function: wrap the existing body and post-process its result.

### 2. Locations are per agent; health has no page

**Where:** each profile has its own rules (`agent_profiles.ts`: `settings/chat.json`, `voice.json`, `tasks.json`, `health/settings.json`). The router has a Permissions page for chat, voice and tasks only. On Windows the sandbox always reads the chat profile (`sandbox.ts:237`).

**Effect:**
- A folder blocked on the main Permissions page is not blocked for voice, tasks or health: the same write from voice asks instead of being denied, and voice and health can read it.
- Health can never have a blocked or trusted folder.
- A folder trusted in chat is unknown to tasks, so a scheduled task fails with "permission denied" where chat worked. Tasks never ask, so nothing tells the user why.

**Better (pick one):**
- **A — one location list for all agents (recommended).** Every agent reads the chat profile's locations; agents keep their own tool settings. `getPermissions(profileId)` changes in one place, the voice and tasks Permissions pages go away, the Windows exception disappears, and no stored data has to move. Cost: anything trusted while chatting is also writable by unattended tasks.
- **B — blocks shared, trust per agent.** Smaller change in behaviour, more code, and the "why did my task fail" problem stays.

### 3. Reads are open everywhere

**Where:** `resolve_tool_permission.ts:107` allows every read that is not blocked, except in the tasks profile. `sandbox.ts:265` gives commands `denyRead` = blocked locations only, and `sandbox.ts:271` allows every network domain.

**Effect:**
- Chat, voice, health and subagents read any file without a card (`read ~/.ssh/id_ed25519` → allowed).
- Tasks are refused by the `read` tool, but `bash cat` of the same file is allowed in the same run.
- With open network access, text injected through a fetched web page can read a credential file and send it out with no card at any step, including in unattended runs.

So the workspace is the only default location for changes, not for reads.

**Better:**
- **A — built-in protected paths (small, do first).** A fixed list of read blocks added in `withDefaultPermissions` and never stored: `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.config/gh`, `~/.netrc`, `~/.kube`, `~/.docker/config.json`, keychains, browser profiles, and the app's `credentials/`, `providers/`, `mcp/`, `storage/`, `settings/`, `agent-browser/`. The sandbox picks them up without changes, because blocks already become `denyRead`. Keep them read blocks only: task tools write `settings/tasks.json` through the same check, so a write block on `settings/` would break them. Cost: `gh`, `aws` and similar tools stop working inside sandboxed commands.
- **B — reads follow the same rule as writes.** Outside trusted locations a read asks (chat, voice) or is denied (unattended). This needs built-in read access to skill and plugin folders, and a sandbox read policy, otherwise commands bypass it. Larger; a product decision.

### 4. Media tools read any local file given as an input

**Where:** `tools/media/inline.ts:19` reads a local path found in a `url` option of `create_image`, `create_video` or `create_sound`. The permission check only looks at the output `directory`.

**Effect:** the `read` tool on a blocked file is denied; `create_image` with `image.url` pointing to the same file is allowed, and the file is read and sent to the media provider. It also bypasses the tasks read limit.

**Better:** treat these paths as read targets of the tool: collect the local `url` values once (shared with `inline.ts`) and run them through the read rule in the resolver. About ten lines.

### 5. "Trust this location" covers one tool kind only

**Where:** `run_tool_call.ts:353` stores the rule for `write` (file tools) or `exec` (commands), never both.

**Effect:** after trusting a folder from a `write` card, a command that needs the same folder asks again, and the reverse. The Add form in Settings already stores all three kinds at once.

**Better:** store the folder for read, write and exec, like the Settings form. Three lines. Later, one trusted list instead of three; the kinds only matter for blocks.

### 6. Defaults were saved into the profile file

**Fixed in this pass.** `setPermissions` used to store the merged result of `withDefaultPermissions`, so a dropped default stayed on disk; this is why Library remained in existing profiles. Now only the user's own rules are saved and the workspace is added on load (see "Changed in this pass").

Still to do for several workspaces: a profile saved by an older version contains the default workspace path, which stays trusted after switching to another workspace. The cleanup planned in `WORKSPACES.md` ("Stop trusting the previous workspace") is only needed for those old lists.

### 7. Unattended runs are handled by two mechanisms

**Where:** `run_tool_call.ts:88` (tasks profile → `deny` instead of `ask`), `run_tool_call.ts:303` (no window → `ask` becomes `deny`), `run_tools.ts:22` (tools set to "Ask" are hidden for tasks only).

**Effect:** tasks, health and subagents are all unattended, but only tasks get the read limit and only tasks hide "Ask" tools. Health and subagents are offered tools that are always denied when called, which wastes turns.

**Better:** one rule: a run is interactive when it has a window. Interactive → ask, otherwise → deny, and hide "Ask" tools when not interactive. This removes the `tasks` special case in both files. Whether unattended reads are limited then follows from the decision in finding 3.

### 8. Reset on the Permissions page also resets the Tools page

**Where:** `agent_store.ts` `resetPermissions` also sets `tools: {}` for that profile.

**Effect:** a tool that was turned off on the Tools page is turned on again by Reset on the Permissions page.

**Better:** Reset restores locations only. Two lines removed, plus the assertion in `agent-store.test.ts` that expects the current behaviour.

### 9. Still open from `PERMISSIONS_SECURITY.md`

- **#5 upper/lower case bypass (reproduced again):** with `workspace/private/**` blocked, a write to `workspace/PRIVATE/a.txt` is allowed. Fix: `fs.realpathSync.native` in `shared/real_path.ts`, and a case-insensitive comparison on macOS and Windows in `permissions/permission_for.ts`.
- **#6 `env` on host commands (by reading):** `execution/environment.ts` still accepts `PATH`, `GIT_*` and similar with `elevated: true`. Fix: reject `env` when `elevated` is set.
- **#7 microphone (by reading):** `microphone_recorder` defaults to "Allow" (`agent_profiles.ts:39`). Fix: default it to "Ask".

### 10. Coder does not use these rules

Coder runs Codex with Codex's own sandbox (`workspace-write`) and approvals (`coding/harness/codex.ts:184`). Trusted and blocked locations from the Permissions page do not apply there. Say so on the Permissions page; mapping blocks to Codex is a later decision.

## A simpler shape (optional)

Today the answer to "which paths does this tool touch" is spread over name lists in six files (`isWritePermissionTool`, `TASK_TOOLS`, `MEDIA_TOOLS`, `AGENT_FILES`, the sets in `execution/capability.ts`) and a resolver with eight positional arguments. Findings 1, 4 and 7 come from that.

1. Each tool declares what it touches, next to its existing `capability`: `access(input) → { read?, write?, exec?, managed? }`. Task tools and media tools saving to their own folder return `managed`.
2. One resolver with no tool names, in a fixed order: blocked → deny; tool off → deny; tool "Ask" or sensitive → ask; every path trusted or managed → allow; otherwise ask when interactive, deny when not.
3. One location list shared by all agents (finding 2A).

This is a medium refactor: about fifteen tools get an `access` function, and four files under `permissions/` go away. Do the small fixes first; start this only when more path-based tools are planned.

## Suggested order

1. Finding 1 — blocks must always win.
2. Finding 3A — protected paths.
3. Finding 2A — one location list.
4. Findings 4, 5, 8, and #5, #6, #7 from the earlier review — each a few lines.
5. Finding 7 — remove the special case.

## How this was checked

A scratch script bundled the real modules with esbuild, replaced `electron` and `electron-store` with in-memory stand-ins, pointed `KUCEDR_E2E_DATA_ROOT` at a temporary folder, and called `getPermissions`, `setPermissions`, `resolveToolPermissionDetails`, `inlineFiles` and `runToolCall` directly. Finding 1 was run end to end: the card was answered with "Allow once" and the file appeared inside the blocked folder. Finding 3 was run as the tasks agent through the real macOS sandbox: the `read` tool was denied for a file outside the workspace, `bash cat` of the same file printed its contents, and a `bash` write next to it was blocked. The rules saved in this machine's chat and tasks profiles were copied (read only) into the same script: both now load as the workspace only, a user rule and a block in an old list are kept, and Library added on purpose afterwards is kept. `tsc` and `eslint` pass on the changed files. The expectations in `agent-store.test.ts` were updated for the new default; no tests were run and the app was not launched.
