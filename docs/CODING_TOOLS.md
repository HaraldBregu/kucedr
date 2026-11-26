# Coding agent tools plan

Status: proposal, 2026-11-26. Nothing here is implemented. Roadmap items 20.5–20.8
([roadmap/CODING.md](roadmap/CODING.md)).

## Goal

The main chat agent can hand coding work to an external coding agent (a "harness") such as Codex,
Cline, Pi or OpenCode. The user asks in the normal chat, for example "fix the failing test in
my-app". The agent delegates the task, then reports what changed and how to continue.

- **One tool.** `use_coding_agent` works with every harness. Harnesses are picked by ID from
  manifest data.
- **Harnesses are data.** Each one is a `coding-agent` model in a bundled plugin manifest. `src`
  holds no product names, as with providers today.
- **Two protocols.** The existing `app-server` adapter (Codex) and a new `acp` adapter for the
  [Agent Client Protocol](https://agentclientprotocol.com), which most other harnesses speak.
- **Same safety as bash.** Every harness runs inside Kucedr's sandbox, tied to the run's workspace.

## What exists today

- `src/main/coding` is the back end of the hidden coding page: a `Coder` service, a session
  store and journal, sealed credentials and per-harness home folders.
- `src/main/coding/harness` defines `CodingHarness`. [protocols.ts](../src/main/coding/harness/protocols.ts)
  maps a protocol ID to an adapter, and only `app-server` exists.
- [harnesses.ts](../src/main/coding/harnesses.ts) lists harnesses from manifests with
  `modelsFor('coding-agent')`. Codex is the only one (`resources/plugins/openai/models/codex`).
- Codex is launched with flags hard-coded in [rpc.ts](../src/main/coding/harness/rpc.ts), from a
  binary found in the app's `node_modules` ([executable.ts](../src/main/coding/harness/executable.ts)).
- The main agent has no way to call any of this. The closest precedent is `subagent`
  ([AGENT_TOOLS.md](AGENT_TOOLS.md)).

## The tool

`use_coding_agent`, in `src/main/agent/tools/coding/delegate.ts`, built with `jsonTool` because its
schema comes from manifest data. Category `delegation`. It is not preloaded and loads through
`tool_search`, like `subagent`.

**Input:**

| Field     | Meaning                                                                         |
| --------- | ------------------------------------------------------------------------------- |
| `task`    | The full instruction. Required.                                                 |
| `agent`   | Harness ID, an enum of available harnesses with manifest names as descriptions. Defaults to the manifest default. |
| `folder`  | Working folder, relative to the workspace files folder or absolute. Defaults to the workspace files folder. |
| `session` | A session ID returned earlier. Continues the same harness thread.               |
| `review`  | `true` means read only: the harness may read but not change anything.           |

With `session`, the folder, harness and settings come from the stored session. Passing a different
`agent`, `folder` or `review` is an error that says so.

**Output**, modelled on the subagent result:

```json
{
	"status": "completed | cancelled | failed | timeout",
	"agent": "<id>",
	"session": "<session id>",
	"folder": "<real path>",
	"text": "<final message, at most 12,000 characters>",
	"changedFiles": ["src/app.ts"],
	"declined": ["npm install (needs network)"],
	"questions": ["Which branch should I target?"],
	"error": "<message>"
}
```

The full event stream stays in the Coder session journal. The tool result carries only the summary.

**When the model uses it** (tool description and [TOOL_SELECTION.md](TOOL_SELECTION.md)): for
multi-file or multi-step changes in a code repository, running and fixing tests or builds, or when
the user names a coding agent. Small edits, single-file changes, reading code to answer a question
and anything that isn't code stay on the agent's own file tools. On `timeout`, call again with the
same `session`. On `declined` or `questions`, tell the user rather than retrying.

**Where it is available:** main chat only. It is registered in `run_stream` next to the memory
tools, behind the same `!restricted && category === 'main'` gate, and only when a harness is
available. It is excluded from voice (`shared/agent_tools.ts`, following the voice realtime-models
rule), from subagent children (`PARENT_ONLY_TOOL_IDS`), from tasks and health (allowlists), and from
read-only modes (`readOnly: false`).

**Availability** is cached in `Coder`: installed (executable resolves) and signed in. It is refreshed
when the model catalog changes and after connect or disconnect, so tool assembly stays synchronous.

## Harnesses are manifest data

`ModelHarness` in [model_types.ts](../src/shared/model_types.ts) gets generic launch fields:

| Field      | Meaning                                                                              |
| ---------- | ------------------------------------------------------------------------------------ |
| `protocol` | `app-server` or `acp` (exists today as `metadata.protocol`)                          |
| `package`  | Optional. When set, the binary comes from the app's `node_modules` (bundled Codex).  |
| `binary`   | The executable. Without `package`, it is looked up on the login-shell `PATH`.         |
| `args`     | Launch arguments, with the placeholders `{home}` and `{credentials}` only            |
| `env`      | Fixed environment variables. Keys from the sandbox's blocked list are rejected.      |
| `homeEnv`  | Exists today. When set, the harness gets its own home under Kucedr's data.           |
| `apiKeyEnv` | The variable an API key is passed in, when the protocol can't take it directly      |

Codex's `app-server -c ...` flags move from `rpc.ts` into its manifest. The bundled-binary layout in
`executable.ts` stays as a documented exception, because it is the npm package format and not a
product name.

**Only bundled manifests may launch programs.** `binary`, `args` and `env` are honored only from
plugin manifests shipped in `resources/plugins`. User and imported provider packs override
built-ins today ([models.ts](../src/main/models.ts)). Without this rule they could turn any manifest into
a command the agent can start. Adding a harness therefore means shipping its manifest with the
app, and the code doesn't change.

**Finding the binary:** most harnesses are npm scripts starting with `#!/usr/bin/env node`. A
GUI-launched app on macOS has a minimal `PATH`, so both the lookup and the spawned environment use
the existing login-shell `EnvironmentManager` ([terminal/environment.ts](../src/main/terminal/environment.ts)).

**Harness homes:** when a manifest sets `homeEnv`, the harness gets its own home with its own
sign-in, as Codex has today. Without it, the harness uses the user's own config and sign-in, and
the user's own approval settings for it apply. Settings > Code says which one applies.

## Protocol adapters

### `app-server` (Codex)

Exists ([app_server.ts](../src/main/coding/harness/app_server.ts)). Changes:

- Launch arguments come from the manifest.
- On `fileChange` completion, the adapter reads the item's changes, so `changedFiles` can be
  filled. `HarnessEvent` gets an optional `paths` field.
- `item/tool/requestUserInput` is reported as a question, not answered with empty input.

### `acp` (new)

`src/main/coding/harness/acp.ts`, implementing `CodingHarness` over the existing JSON-RPC transport.
`rpc.ts` gets an option for the `"jsonrpc": "2.0"` field, a per-request timeout (none for
`session/prompt`, which only answers when the turn ends; it is bound to the abort signal instead),
and keeps the JSON-RPC `error.code` so `auth_required` can be detected.

| Step         | Behaviour                                                                          |
| ------------ | ---------------------------------------------------------------------------------- |
| Start        | `initialize` with `protocolVersion: 1` and no `fs` or `terminal` client capabilities, so the agent uses its own tools in the folder |
| Sign in      | `authenticate` for methods of type `agent`. Harnesses that offer only terminal sign-in are listed as "sign in outside the app" until the terminal panel (area 14) exists |
| New session  | `session/new` with the absolute folder and no MCP servers                          |
| Resume       | `session/resume` when advertised. Otherwise `session/load`, dropping every update that arrives before its response, because load replays the whole history. Otherwise a new session, and the result says so |
| Prompt       | `session/prompt` with one text block; the turn ends on its stop reason             |
| Updates      | Message chunks → text, thought chunks → thinking (optional), `tool_call` / `tool_call_update` → tool events, with diffs and locations feeding `changedFiles`. Unknown update kinds are ignored |
| Permissions  | To decline: the first `reject_once` option, else `reject_always`. To allow (step 4): only `allow_once`, and decline if there is none |
| Cancel       | The `session/cancel` notification, every pending permission answered `cancelled`, then the process tree is stopped |

No session modes are set: the protocol is replacing them with config options. The official ACP SDK
is not added unless the hand-written framing proves insufficient.

## Run flow

1. The model calls `use_coding_agent`. `runToolCall` checks the folder (see Security), then calls
   the injected runner inside the execution scope.
2. `Coder.delegate(request, signal)` shares `send()`'s session and journal code. It resolves the
   project from the folder before checking a resumed session, links the tool's abort signal into the
   run, uses the chat window ID as owner, and replaces the interactive `approve` with one that
   declines and records each request (`declined`, `questions`).
3. The harness starts **one process per call**, inside the sandbox, as `AppServerHarness` already
   does. Resume works through the stored native session ID.
4. Version 1 doesn't stream into the chat. Events go to the Coder journal, and the card shows the
   result when the call ends, like `subagent`.
5. The tool has its own deadline of 510 seconds, under its 540-second timeout and the 10-minute run
   timer. On the deadline it interrupts the harness and returns `timeout` with the session, so the
   model can continue. `runToolCall`'s own timeout would discard the session ID.
6. On stop, window close or timeout, the adapter interrupts the turn, waits briefly, then stops the
   whole process tree, so test runners or dev servers the harness started don't keep writing.

The runner is injected through the Agent constructor, `StreamOptions` and `run_stream`, as memory is.

## Security

Kucedr's location rules only reach the folder a harness starts in. Inside that folder the harness
uses its own tools. Codex's sandbox reads the whole disk by default, depends on the platform
(bubblewrap on Linux), and most ACP agents have none. Copilot in ACP mode reportedly never asks for
permission. So:

- **Every harness runs inside Kucedr's sandbox** (`ExecSandbox.wrap`), like bash: protected reads
  denied (`~/.ssh`, credentials, app data and, with [WORKSPACES.md](WORKSPACES.md), other workspaces),
  protected writes denied, the environment allowlist, and process-tree kill. Network stays open,
  because the harness calls its own model. Codex's own sandbox is turned off inside it on macOS,
  because two sandboxes cannot nest there.
- **`review: true`** uses the sandbox's read-only mode, so it holds even for agents that never ask.
- **Folder check:** the tool declares `write` and `exec` on the folder. Inside the workspace or a
  trusted location it runs without a card. Elsewhere it shows the approval card in chat and is denied
  in unattended runs. A folder that is broad (home, root) or contains a protected root is denied,
  not just carded: a card cannot replace the sandbox's write blocks.
- **No resource lock on the folder.** The generic lock would block every other chat's bash for
  minutes. `Coder` refuses a second harness run in the same folder instead.
- **Credentials:** `~/.kucedr/coder` (every harness home) is added to the protected reads, so the
  main agent's bash can't read harness sign-ins. API keys go through the protocol where it supports
  that (Codex does). Where only an environment variable works (`apiKeyEnv`), Settings > Code says that
  commands the harness runs can see the key.
- **Privacy Mode** blocks every harness (`requireUnrestrictedNetwork`), and the tool says so.
- **Budget:** a delegation doesn't count as a paid call. The harness spends the user's own
  subscription or key, and the card shows the harness name.

## Interface

No new components in version 1:

- **Tool card:** `use_coding_agent` is added to `tool-label.ts` and `tool.tsx`, reusing
  `DelegationOutput` with a heading prop (it says "Subagent result" today) and changed files shown as
  file chips.
- **Settings > Tools:** listed under coordination next to `subagent`, with Allow, Ask and Deny.
- **Settings > Code:** the harness list with Connect and Disconnect, reusing the coding page's
  renderer code and the existing `ipc/coder.ts` flow. It shows "not installed" with the manifest's
  install hint, "sign in outside the app" where needed, and whether the harness uses its own home.
  Only this entry loses its "coming soon" mark. The coding page stays hidden.

## Workspaces

With [WORKSPACES.md](WORKSPACES.md), the tool's default folder is the run's workspace files folder, and
the protected reads come from the run's workspace. Harness homes and Coder sessions live under the
workspace root (`<root>/coder`), so sign-ins and harness threads stay per workspace. For the default
workspace that is today's `~/.kucedr/coder`.

## Alternatives considered

**Run the harness's headless CLI through bash.** Bash already has a `pty` option for coding
agents and gives the same sandbox. It loses structured events, resumable sessions, in-run approvals
and the changed-file list, and every harness has a different output format. The adapter path is
kept, but it uses the same sandbox, so it is no less safe.

**One tool per harness** (like `mdl__*` tools). More prompt and schema cost for the same action, and
names would leak into tool IDs.

## Harness notes

Checked 2026-11-26 from public docs and third-party adapters, not from running the binaries. Each
harness needs a bundled manifest before it is offered. All are user-installed except Codex.

| Harness       | Executable     | Protocol                                   | Sign-in                                   | Steer | Notes |
| ------------- | -------------- | ------------------------------------------ | ----------------------------------------- | ----- | ----- |
| Claude        | `claude`       | `acp` through `claude-agent-acp`; steering needs the CLI's own `stream-json` input and output | API key, Bedrock or Vertex | Yes | Anthropic does not allow third-party apps to offer claude.ai sign-in. Must not be named "Claude Code" |
| Codex         | `codex`        | `app-server`                               | ChatGPT account, API key or model provider | Yes | Bundled today. Steering through the app-server protocol, not yet confirmed |
| OpenCode      | `opencode`     | `acp` (`opencode acp`)                     | Configured inside OpenCode                | No    | Check the license before shipping a manifest |
| Cursor        | `cursor-agent` | `acp` (`agent acp`)                        | `agent login`, `CURSOR_API_KEY`           | No    | The docs now name the binary `agent`; the manifest checks both. Older builds lack `acp` |
| Antigravity   | `agy` ≥ 1.5.0  | `acp` (`agy acp`)                          | Keyring and Google sign-in (terminal)     | No    | A forum thread reports that wrapping `agy` in third-party apps is not supported on consumer plans. Confirm before shipping |
| Grok Build    | `grok`         | `acp` (`grok agent stdio`)                 | `grok login`, `XAI_API_KEY`               | No    | ACP conformance not confirmed |
| Devin CLI     | `devin`        | `acp` (`devin acp`)                        | `devin auth login`, `WINDSURF_API_KEY`    | No    | Reportedly advertises only a browser auth method in ACP and ignores stored CLI credentials |
| Pi            | `pi`           | `acp` through `pi-acp`; steering needs Pi's own RPC mode | Subscription login or API key | Yes | Sign-in is terminal only. Pi's RPC mode has no approvals |
| Oh My Pi      | `omp`          | `acp` (`omp acp`)                          | Configured inside Oh My Pi                | No    | Permission prompts map to `session/request_permission` |
| Factory Droid | `droid`        | `droid exec` with `stream-jsonrpc` input and output; ACP not confirmed | Device pairing, `FACTORY_API_KEY` | No | May need a third adapter if native ACP isn't official |

Eight of the ten work over `acp`. Steering an active turn (roadmap 20.9) is not part of ACP, so it
needs each harness's own protocol: Codex's `app-server`, Claude's `stream-json` and Pi's RPC mode.
Aider has no protocol and is not covered.

## Implementation order

1. **Launch shape and sandbox.** Generic manifest fields (bundled manifests only, validated),
   Codex flags moved to its manifest, `EnvironmentManager` for lookup and spawn environment,
   harnesses launched inside `ExecSandbox`, detached and tracked for process-tree stop,
   `~/.kucedr/coder` protected, per-request timeouts and error codes in `rpc.ts` → verify: a Codex
   turn through the coding IPC still works; a harness asked to read `~/.ssh` or a protected app file
   is denied; stopping a turn also stops a child process the harness started; `grep` finds no
   launch flags in `rpc.ts`; no new main test failures against the baseline.
2. **The tool with Codex.** `Coder.delegate`, `use_coding_agent`, availability cache, registration,
   the 510-second deadline, resume rules, the per-folder guard, `changedFiles`, `declined` and
   `questions`, card and settings entries, the Settings > Code list → verify with a mock model and a
   fake app-server harness: the card shows the changed file; a folder outside the workspace shows the
   card; home and protected folders are denied; an approval request is declined and listed; Stop
   interrupts the harness; a timeout returns the session and a second call resumes it; Privacy Mode
   and a missing sign-in give clear errors; the tool is absent in voice, tasks, read-only modes and
   subagents.
3. **Live progress.** A tool progress event that streams harness text, commands and diffs into the
   card and resets the run's inactivity timer; then a longer deadline → verify: a fake harness that
   works for 12 minutes completes and the card updates live; a silent one still times out.
4. **Approvals in the chat.** In-run requests show the usual approval card in interactive runs;
   unattended runs still decline → verify: Allow continues, Deny declines, Stop answers `cancelled`.
5. **The `acp` adapter and harness manifests.** → verify with a fake ACP agent: initialize, new
   session, resume and load (no replayed history in the result), prompt, updates, unknown update
   kinds, permission options without a once-variant, cancel, and `auth_required`. A real harness is
   checked only with the user's go-ahead.

## Open decisions

Each has a recommendation, used above unless changed:

- **Bundled vs user-installed harnesses.** Recommended: only Codex bundled; other harnesses are
  installed by the user and found on `PATH`, with their manifests shipped in the app.
- **Own home or the user's.** Recommended: per manifest. Use a separate home where the harness
  supports it, so the user's auto-approve settings don't apply inside Kucedr; otherwise say that
  they do.
- **Default permission.** Recommended: Allow inside the workspace, like bash. Make Ask the default
  only after [PERMISSIONS_AGENTS.md](PERMISSIONS_AGENTS.md) finding 1 (Ask skips location blocks) is fixed.
- **Scheduled tasks.** Recommended: excluded in version 1. A scheduled agent changing repositories
  needs its own decision.
- **The coding page.** The tool uses the harness without the page, so it gives the harness a use
  whether the page ships or is removed. Sandboxing every harness also covers 20.2 for this path.

## Known limitations

- Until step 3, long jobs stop at about 8.5 minutes and need a resumed call.
- Until step 4, in-run approvals are declined, which can leave a task half done. The result lists
  what was declined so the model can tell the user.
- ACP is young and its adapters are early. Resume support varies by harness.
- Harnesses with terminal-only sign-in must be signed in outside the app until area 14.
- The model may delegate small edits, which is slower and spends the user's harness quota. The tool
  description keeps small edits on the built-in tools.
