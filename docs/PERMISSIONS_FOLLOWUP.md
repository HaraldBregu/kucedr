# Tools & Permissions — Follow-up Plan

What is left after the path-rule fix and cleanup (see `PERMISSIONS_SECURITY.md`, `TOOL_SELECTION.md`).

Status: items 1, 2, 3 and 5 are implemented as written; the "Verify" steps that need the running app are still to do. Item 4: 4a and 4b are done (the `main` jest project went from 216 to 130 failing tests, no new failures); 4c is open. Differences from the plan:
- 1: workspace and library are exempt from the app data rule, so a bash root there can still be remembered.
- 4a: the five runner suites mock `session_session_dir` instead of building real session folders. Two tests in `run-stream-prompt.test.ts` still fail: one needs real session persistence, one imports the removed Plan mode.
- `undo`/`redo` with nothing to undo are allowed without a prompt (`resolve_tool_permission.ts`); the path-rule fix had made them ask.

| # | Item | Size |
|---|------|------|
| 1 | "Always allow" still offered inside the app data folder and for broad bash roots | 2 lines |
| 2 | Sandbox uses the chat profile's rules for every profile | small |
| 3 | Settings shows "Allow" for tools the backend asks for | 1 line |
| 4 | Runner tests broken by a session fixture; stale assertions | tests only |
| 5 | Lint errors in `tools/core/bash.ts` | 1 line |

Order: 1 → 3 → 5 → 2 → 4. Items are independent.

---

## 1. No reusable grants inside app data or for broad bash roots

**Problem**
- `permissions/broad.ts` blocks "Always allow" for a folder that *contains* `userDataLocation()`, but not for one *inside* it. Approving a write to `~/.kucedr/settings/chat.json` "always" persists `~/.kucedr/settings/**`, after which the agent can rewrite its own permission files silently (finding #2, self-escalation). Same for `mcp/`, `skills/`, `plugins/`, `providers/`.
- `permissions/command.ts` never calls `isBroadTarget`, so bash with `additionalRoots: ["~"]` approved "always" persists `exec.allow: ~/**`, which becomes sandbox `allowWrite` (finding #3, bash half).

**Fix**
- `broad.ts`: also return true when the target is inside app data — add `isPathWithin(data, target)` next to the existing `isPathWithin(target, data)`. Workspace and library are already allowed by default rules, so they never reach an approval and are unaffected.
- `command.ts`: `persistable: !elevated && !decisions.includes('deny') && approvalTargets.length > 0 && !approvalTargets.some(isBroadTarget)`.

**Result**
Writes into app data outside workspace/library still work, but ask every time (approve once), and are denied in runs without a window. Nothing is hard-denied, so asking the agent to create a skill or edit an MCP config by hand still works with one approval.

**Decision to confirm**
Stricter alternative from `PERMISSIONS_SECURITY.md` #2: inject non-removable *deny* rules for app data. Not recommended now: deny rules also flow into `command.ts` (a bash `workdir` under `plugins/` would be denied) and the sandbox, and it is not yet known which app data folders scripts, the coder harness and skills legitimately write to.

**Verify**
- Chat: "edit `~/.kucedr/settings/chat.json`" → card with only "Allow once"; `chat.json` unchanged after approving.
- Chat: bash with `additionalRoots: ["~"]` → card with only "Allow once".
- Chat: bash with `additionalRoots: ["~/Documents/some-project"]` → "Always allow" still offered.

---

## 2. Sandbox follows the run's profile

**Problem**
`sandbox.ts` `configuration()` (line 240) and `wrapReadOnly()` (line 293) call `getPermissions()` with no argument, which is the chat profile. `resolveCommandPermission` uses the run's profile. The two layers disagree for tasks, voice and health:
- an exec rule saved under the tasks profile is approved by the resolver, then blocked by the sandbox;
- a deny rule set only on the tasks profile is not enforced by the sandbox.

**Fix**
- `execution/scope.ts`: add optional `profile?: AgentToolProfileId` to `ExecutionScope`.
- `runner/run_tool_call.ts`: where the local `scope` is built (line ~57), set `profile: security.toolProfile`. The tool already runs inside `executionScope.run(scope, …)`.
- `sandbox.ts`: in both places, `getPermissions(executionScope.getStore()?.profile ?? 'chat')`.

No new storage and no new parameter through `bash.ts`: on macOS/Linux `wrap()` already passes a per-command `customConfig` built from `configuration()`.

**Limit**
Windows initializes the sandbox once from a global config (`fingerprint`), so it keeps the chat profile's rules there. Document it; do not restructure the Windows path without a machine to test on.

**Verify**
- Add an exec allow rule for `~/Documents/task-out` on the tasks profile only. A scheduled task runs `touch ~/Documents/task-out/a` with that root → succeeds. The same command from chat → asks.
- Add a write deny rule on the tasks profile for a workspace subfolder → a task's bash write there fails with the sandbox message.

---

## 3. Settings shows the real default

**Problem**
`getAgentProfileTools` (`agent_profiles.ts:252`) returns only stored entries. The settings page falls back to `allow` (`settings/pages/assistant/tools/Page.tsx:456`), while `getAgentProfileTool` falls back to `DEFAULT_TOOL_SETTINGS` (`ask` for `camera_recorder`, `update_health`). The UI says "Allow", the agent asks.

**Fix**
`getAgentProfileTools`: `tools: { ...DEFAULT_TOOL_SETTINGS, ...profile.tools }`. One source of defaults, no renderer change.

**Not included**
On the tasks profile the UI still offers "Ask", which hides the tool from task runs (`filterProfileTools`). Hiding the option or relabeling it is a UI decision; say so if wanted.

**Verify**
Fresh profile → Settings → Assistant → Tools: Camera recorder shows "Ask". Changing it to "Allow" and back persists.

---

## 4. Tests

Baseline today: 216 failing tests in the `main` jest project, none caused by the permission work.

**4a. Session fixture (largest group, in scope)**
`run_stream.ts:222` calls `sessionDir(session)` on every run; `createSessionState()` returns `folderName: ''`, and `sessionPath` throws `Invalid assistant session id.` Production sessions always have a UUID folder, so the fix belongs in the tests: suites that call `stream()` with `createSessionState()` (`run-stream-prompt`, `browser`, `mcp-authorization-retry`, `run-background-tools`, `agent-tasks`, …) get a session with `folderName: crypto.randomUUID()` and `sessionsPath` set to a temp directory.

**4b. Stale after the tasks-profile commits (in scope, after 4a)**
- `run-stream-prompt.test.ts` "exposes only task-management tools for an explicit scheduled-task update": expects `['list_tasks', 'update_task']`; the narrowing it tested was removed. Update the expectation to the current active set, or delete the case.
- Remove assertions on fields that no longer exist: `hardApproval` in `mcp-tool.test.ts`, `native-tool-metadata.test.ts`, `recorder-tools.test.ts`; `onChanged` in the `loadMcpTools` mocks of `run-stream-prompt.test.ts` and `browser.test.ts`.

**4c. Out of scope here (separate triage)**
- Ten suites import modules that no longer exist (`agent/plan/*`, `agent/goal/*`, `tools/web/map`, `apps/app_import`, `coding/pi`). Each needs a rename-or-delete decision.
- Unrelated areas: MCP OAuth, models catalog, RAG, providers, app windows.

**Verify**
Run the `main` project before and after and diff the failing test names: 4a/4b names disappear, no new names appear.

---

## 5. Lint

`tools/core/bash.ts:417-419` destructures fields only to drop them from the result; `no-unused-vars` flags all seven. Add `ignoreRestSiblings: true` to the rule in `eslint.config.mjs:43`. This is the option meant for that idiom; renaming seven variables to `_x` is noisier.

**Verify**
`npx eslint src/main/agent` → no errors.

---

## Still open after this plan

- Live check of the path-rule fix in the app (needs a configured provider): outside write shows the card; home folder offers "Allow once" only; deny rule wins; task and health runs finish with no pending approval.
- `PERMISSIONS_SECURITY.md` #4 (default read deny list for credentials), #5 (case-insensitive deny bypass on macOS), #6 (env on elevated commands), #7 (microphone approval, profile-update tools).
- `reuseContext` parameter and the `resolveToolPermission` wrapper: dead in production, used by ~28 test call sites.
