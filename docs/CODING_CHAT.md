# Coding Chat — Plan

> **Status:** plan, 2026-11-24. Nothing here is implemented. Roadmap: [20. Coding page](roadmap/CODING.md).

## Goal

Two kinds of chat in the same sidebar:

| Kind | Who answers | Works on |
| --- | --- | --- |
| **Agent chat** (today's chat) | Kucedr's own agent, with its tools, memory and plugins | Anything |
| **Coding chat** (new) | An external coding harness (Codex today; others such as Pi, Cline or Claude Agent SDK later) | One repository folder chosen when the chat starts |

The user picks the kind when starting a chat. A coding chat looks and behaves like a chat (messages, streaming, stop, approvals), plus a repository badge and a changed-files view.

## What exists today

Most of the backend is already built and hidden. Reuse it rather than start over.

| Piece | Where | State |
| --- | --- | --- |
| Harness interface (`run`, `listModels`, `connect`, `deleteSession`) | `src/main/coding/harness/types.ts` | Works |
| Codex adapter over the `app-server` JSON-RPC protocol | `src/main/coding/harness/app_server.ts`, `rpc.ts` | Works, one protocol |
| Harness chosen from plugin manifests (`type: coding-agent-model`, `metadata.protocol`, `metadata.harness`) | `resources/plugins/openai/models/codex/manifest.json`, `src/main/coding/harnesses.ts` | Generic, no product names in `src` |
| Protocol registry | `src/main/coding/harness/protocols.ts` | One entry: `app-server` |
| Sessions, transcript, projects (repository folders), instructions files | `src/main/coding/sessions.ts`, `transcript.ts`, `projects.ts`, `instructions.ts` | Works |
| Run orchestration, approvals (`interaction` / `interaction-resolved` events), credentials | `src/main/coding/coding.ts`, `credentials.ts`, `src/main/ipc/coder.ts` | Works |
| Coding screen | `src/renderer/src/pages/code` (~1,100 lines) | Unreachable: `code/*` redirects to `/workspace` (`src/renderer/src/router.tsx:276`) |
| Unit test | `tests/unit/main/coding/coding.test.ts` | Imports a module that no longer exists |

So the gap is mostly **product surface** (no way in), **one chat list** (coding sessions live apart from agent chats) and **one protocol** (only `app-server`).

## User flow

1. Sidebar → **New chat** becomes a split: **New chat** (agent, default, unchanged) and **New coding chat**.
2. New coding chat asks for a repository folder (recent projects first, then the folder picker) and a harness + model (defaults from the manifest marked `default`).
3. If the harness is not signed in, the chat shows the harness's own sign-in (`connect`), as the coding screen does today.
4. The user types. The harness streams text, thinking, tool calls and commands into the chat. Approvals show as the same approval card the agent chat uses.
5. A **Changes** panel lists files the run touched with diffs (from `git diff` in the repository). Accept = keep, reject = `git restore` for that file.
6. The chat appears in the sidebar with a code icon and the repository name. Opening it restores the transcript and resumes the harness session (`nativeSessionId`).

## Design

### 1. One sidebar, two stores

Keep the two stores (agent sessions under `src/main/agent/session/`, coding sessions under `src/main/coding/sessions.ts`). Do not merge the formats: the harness owns its own history, Kucedr only keeps a transcript.

The sidebar list merges both: `listSessions` (agent) + `coding.listSessions` (all projects), each row tagged `kind: 'agent' | 'coding'`, sorted by `updatedAt`. Rename, pin, archive and delete route by `kind`.

### 2. Routes

- `/home` keeps the agent chat.
- `/code/:sessionId` opens a coding chat. Replace the redirect in `router.tsx` with the coding page, trimmed to: messages, composer, Changes panel. The existing `Sidebar.tsx` / `Sessions.tsx` inside `pages/code` go away; the main sidebar replaces them.
- Reuse the agent chat's message, composer and approval components where the event shapes allow it, so both kinds look the same. Map `CodingResponseEvent` (`text-delta`, `thinking-delta`, `tool-start/end`, `command-*`, `interaction`) onto those components; do not build a second set.

### 3. Harness protocols

A harness is added by a plugin manifest plus, only when its wire protocol is new, one protocol adapter in `src/main/coding/harness/`. No harness name appears in `src` ([no product code in src](../docs/PROVIDERS.md)).

| Protocol | Covers | Work |
| --- | --- | --- |
| `app-server` | Codex | Exists |
| `acp` (Agent Client Protocol, JSON-RPC over stdio) | Harnesses that ship an ACP mode or adapter. Which of Pi, Cline, Claude Agent SDK do so today is **not verified**; check each before choosing | One adapter, then each harness is a manifest |
| Per-harness SDK (in process, e.g. a Node SDK) | A harness with no stdio protocol | One adapter per harness; avoid unless needed |

Recommended: add `acp` as the second protocol, because one adapter can cover several harnesses. Before writing it, confirm for each wanted harness: the launch command, the auth model (API key vs its own login), the approval events it emits, and session resume.

`harnessExecutable` assumes the Codex npm layout (`vendor/<arch>-<target>/bin`). Extend `metadata.harness` in the manifest with the launch command shape rather than adding branches in code.

### 4. Permissions (roadmap 20.2)

Every harness approval goes through `context.approve` → the app's approval card, with the same rules the agent uses ([PERMISSIONS_AGENTS.md](PERMISSIONS_AGENTS.md)): file writes outside the repository and network/shell commands ask; reads inside the repository do not. `toolMode: 'read-only'` stays as the strict option. Harnesses that cannot route approvals through the protocol run read-only only.

### 5. Commands and terminal (roadmap 20.3)

Out of the first version. Command output stays as the `command` block it is today. Moving it into the app terminal waits for the terminal panel (roadmap 14.2).

## Steps

| # | Step | Verify |
| --- | --- | --- |
| 1 | Fix or delete `tests/unit/main/coding/coding.test.ts` so the coding tests run | `npm run test:main -- tests/unit/main/coding` passes |
| 2 | Sidebar lists both kinds; **New coding chat** entry; `/code/:sessionId` route replaces the redirect | Create a coding chat on a test repo, it appears in the sidebar, reopens after restart |
| 3 | Coding chat view built from the agent chat components | Codex run streams text and commands; Stop cancels; approval card approves and denies |
| 4 | Changes panel (git diff, per-file accept/reject) | Run edits two files; rejecting one restores it, the other stays |
| 5 | Same permission rules (20.2) | A write outside the repo asks; a read inside does not |
| 6 | `acp` protocol + first non-Codex harness manifest | Same checks as step 3 with the second harness |

Steps 1–5 ship coding chat with Codex only. Step 6 adds the second harness.

Live checks use the mock-first rule: a fake harness binary speaking the protocol, then a real harness only with the user's go-ahead.

## Open decisions

1. **Which second harness.** Recommended: whichever of Pi, Cline or Claude Agent SDK speaks ACP today, so step 6 is one adapter. Needs the check in Design §3.
2. **Changes panel in v1 or later.** Recommended: v1. Without it the user cannot see what the harness changed short of opening the repository elsewhere.
3. **Credentials.** Codex uses its own sign-in, sealed under `CODEX_HOME`. Recommended: each harness keeps its own login or API key, stored by the existing `credentials.ts`; no shared account.
4. **Workspaces.** If multi-workspace ([WORKSPACES.md](WORKSPACES.md)) lands, coding chats belong to a workspace like agent chats. Nothing here blocks on it.

## Not in scope

- Several harnesses in one chat, or switching harness mid-chat.
- Kucedr's own agent editing repositories (that is the agent chat with file tools, unchanged).
- Remote or cloud sandboxes; the harness runs locally in the chosen folder.
- Commit, push and branch UI (roadmap 20.4).
