# Agent implementation, security, and refactoring review

Reviewed on 2026-09-05 against commit `252a0ff91b` and the clean worktree. Scope: `src/main/agent`, with adjacent IPC, channel, task, recorder, MCP, model, and storage code inspected where it establishes an agent trust boundary. This deliverable changes documentation only.

## Assessment

The implementation has useful application security controls, but its permissions do not provide consistent least privilege across all tools and entry points. Treat it as a desktop assistant with broad access to its owner's resources. It is not ready to serve as a strong isolation boundary for untrusted channel participants, imported instructions, or autonomous access to sensitive integrations.

The highest risks are an ignored MCP approval setting, permissions that authorize destinations without authorizing effects, shared process/browser resources without caller ownership, and inconsistent filesystem containment. Cancellation, session persistence, and aggregate budgets also have correctness defects that can leave effects running or records incomplete.

This is a qualitative source and test assessment, not a penetration-test certification or numeric security score. High severity means a reachable path can disclose data, exercise another run's authority, skip a configured approval, or continue consequential work after apparent interruption. Medium severity covers bounded correctness, privacy, and reliability weaknesses. Preconditions are stated below; findings do not imply an unauthenticated internet attacker can directly execute every tool.

## Current architecture and operating contract

The application assumes one desktop owner. That assumption does not distinguish the owner's interactive requests from messages in allowed channel groups, background schedules, imported skills, or remote tool content. Those inputs have different trust levels even in a single-user application.

| Area          | Current implementation                                                                                                                 | Consequence                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Entry points  | UI text through `AgentIpc`/`Conversation`; channels and schedules through `Agent.send`; separate realtime voice manager                | Text shares one lifecycle, while voice has a separate writer and response lifecycle                    |
| Orchestration | `Agent` admits runs, pins the parent model, schedules by session, streams events and accounts goals                                    | `agent.ts` also owns task startup, history operations and UI event translation                         |
| Runtime       | `runner/run_stream.ts` builds tools/context, discovers MCP, activates skills, invokes models and executes calls                        | Resource lifecycle, policy assembly and budget decisions are intertwined                               |
| Execution     | `runToolCall` parses arguments, checks Plan mode, resolves permissions, awaits approval, acquires locks and runs the tool              | A useful shared enforcement point already used by text and voice                                       |
| Delegation    | Single child with inherited tools; parallel children limited to four inspection tools                                                  | Tool narrowing exists; provider choice, usage and some root limits are lost                            |
| Persistence   | JSON session snapshots, backups, attachment blobs, semantic JSONL traces; Markdown memory/wiki; local RAG vectors plus Pinecone mirror | Atomic replacement prevents partial files, but not concurrent stale writers or excess remote retention |

Sources: [Agent](../src/main/agent/agent.ts#L104), [runtime](../src/main/agent/runner/run_stream.ts#L113), [tool executor](../src/main/agent/runner/run_tool_call.ts#L39), [voice](../src/main/agent/realtime_voice/manager.ts#L62), [delegation](../src/main/agent/tools/core/subagents.ts#L18).

### Permissions as implemented

| Surface            | Actual authority and limits                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Interactive IPC    | Registered main-window/main-frame checks; app views rejected for privileged operations; dedicated workspace app allowed scoped workspace IPC. Approval and cancellation bind to the owning window.                             |
| Filesystem policy  | Global `read`, `write`, `exec` allow/deny paths. Unmatched file mutations ask; reads proceed unless denied. Absence of an approval window makes `ask` become denial.                                                                                    |
| Workspace          | Read, write and exec access are always added. Denies rooted within the workspace are removed. The UI explicitly describes the workspace as always trusted.                                                                     |
| Shell              | Exec grants become both read and write permissions in the command sandbox. Separate read/write denies are not incorporated. Normal shell networking permits all domains and local binding.                                     |
| Elevated execution | Requires approval and runs outside the command sandbox with the application's OS-user privileges; it does not grant administrator/root privileges.                                                                             |
| Other tools        | Unclassified tools default to allowed. A selected set of tools adds `hardApproval`. Media and recorders check output-directory write access, without a distinct paid/sensor permission.                                        |
| Approval reuse     | Bound to run, tool, canonical input fingerprint, window and expiry. “Always” can persist recursive directory rules. Successful reads remember the containing directory for the run.                                            |
| Plan mode          | Filters to `planSafe` tools, rejects approval-requiring actions, constrains shell options, and configures a read-only shell sandbox with no network. Plan-safe web fetch remains available; the whole Plan run is not offline. |
| Channels           | DM/group admission is checked, then admitted messages use background execution with global resources and no tool allowlist. Minimal context changes prompting, not authority.                                                  |
| Schedules/health   | Schedules intentionally default to all tools except task mutation tools; an empty saved allowlist is treated as default. Health explicitly passes `toolsAllow: []` to disable tools.                                           |

Sources: [IPC trust](../src/main/ipc/core/trusted.ts#L13), [approval caller](../src/main/ipc/agent.ts#L328), [resolver](../src/main/agent/permissions/resolve_tool_permission.ts#L12), [workspace policy](../src/main/agent/permissions/with_workspace_permissions.ts#L5), [sandbox](../src/main/agent/sandbox.ts#L219), [read reuse](../src/main/agent/context/context_remember_tool.ts#L3), [channels](../src/main/channels/channels_registry.ts#L146), [schedule defaults](../src/main/agent/agent.ts#L129), [health](../src/main/agent/health/health_run.ts#L42).

### Controls worth preserving

- Main-frame/registered-renderer checks, window-bound approval responses, expiry, fingerprints, and denial when approval is unavailable.
- Schema parsing before execution, Plan filtering at both discovery and execution, explicit hard approvals for selected destructive operations, and no automatic fallback from failed sandbox initialization to host execution.
- Per-session text scheduling, provider/subagent concurrency limits, ordered resource locks, bounded model retries, tool counts and output limits.
- A2A hard approvals, endpoint/origin validation, bounded responses, redirect rejection and credential sealing; MCP schema and transport checks.
- Skill package/resource containment, activation hashes and actual tool narrowing; workspace routing metadata is identified as user-controlled.
- Session UUID/containment checks, atomic snapshots and backups, attachment checksums, semantic traces excluding raw model/tool content; wiki provenance, evidence checks and transactional updates.

Examples: [approval registry](../src/main/agent/permissions/permissions_pending.ts), [A2A fetch](../src/main/agent/a2a/fetch.ts), [skill tool intersection](../src/main/agent/runner/run_skill_tools.ts), [session containment](../src/main/agent/session/session_contained_path.ts), [trace projection](../src/main/agent/session/session_trace_entry.ts), [wiki evidence](../src/main/agent/knowledge/wiki/wiki_verify_evidence.ts).

## Findings

### F1 — High: configured MCP approval is ignored

The loader passes `require_approval`, but `mcpTool` receives it as `_approval` and never applies it. MCP tool IDs then fall through the permission resolver to `allow`. The UI's “Always require approval” setting therefore does not stop an enabled connector operation, including in background runs. The current unit test explicitly expects the approval setting to have no effect.

Evidence: [tool adapter](../src/main/agent/tools/mcp/tool.ts#L10), [loader](../src/main/agent/tools/mcp/loader.ts#L54), [UI setting](../src/renderer/src/pages/settings/pages/mcp/components/McpServerForm.tsx#L264), [current test](../tests/unit/main/agent/tools/mcp-tool.test.ts#L23).

Refactor: make the configured requirement mandatory in the common authorization path. `never` must not override an explicit denial or expand a run's capabilities. Separately model trust to launch an enabled local MCP server: discovery starts stdio commands on the host through [buildTransport](../src/main/mcp/mcp_client_build_transport.ts#L14), before any tool-call approval. Installing/enabling a server may be the owner's launch authorization, but per-call approval is not a sandbox for its startup code.

Acceptance: `always` prevents invocation until matching approval; background execution denies it; rejection, expiry and replay cause zero connector calls; changed local launch definitions require the applicable trust decision before discovery spawns them.

### F2 — High: directory authorization does not authorize the effect

The resolver classifies tools by ID and otherwise permits them. Browser actions can click, submit or evaluate JavaScript in a persistent signed-in profile without a separate effect grant. Camera/microphone recording and paid media generation are classified as writes to their destination directory; choosing the already trusted workspace can satisfy that check without authorizing recording or spending. OS recording permissions still apply. Memory's “after the user explicitly asks” requirement is in the tool description, while execution checks filesystem access.

Evidence: [default allow](../src/main/agent/permissions/resolve_tool_permission.ts#L27), [write classification](../src/main/agent/permissions/directory_permission_targets.ts#L44), [browser operations](../src/main/agent/tools/web/use_web_browser.ts#L185), [camera](../src/main/agent/tools/system/camera_recorder.ts#L9), [memory](../src/main/agent/tools/memory/save_memory.ts#L7).

Refactor: require every exposed tool/action to declare effects and resources; evaluate them in one deterministic policy function. Separate destination access from external actions, sensing, paid calls and durable memory. Reuse explicit owner grants within their declared scope rather than prompting for every harmless substep. Unclassified capabilities must be unavailable until classified.

Acceptance: an unknown tool is denied; a trusted output directory alone cannot authorize sensing/payment; passive browser operations and authenticated submissions are distinguishable; an external page or skill cannot grant itself a new effect.

### F3 — High: background callers share desktop resource authority

Allowed channel messages receive no tool allowlist. The process registry has no owner/run/session identity: another run can enumerate processes and retrieve host-process output, or write to a sandboxed process's stdin. The browser likewise uses one global persistent context and global tab map. A channel participant admitted by configuration can therefore reach resources created by an unrelated interactive run if the model invokes those tools. This is an authorization boundary missing after channel admission, not a bypass of the admission check itself. Process `kill`/`clear`/`remove` do have a separate hard approval.

Evidence: [channel admission](../src/main/channels/channels_security.ts#L10), [channel invocation](../src/main/channels/channels_registry.ts#L146), [process registry](../src/main/agent/tools/core/process.ts#L9), [process resolution](../src/main/agent/permissions/resolve_tool_permission.ts#L29), [browser globals](../src/main/agent/tools/web/use_web_browser.ts#L42). A temporary test confirmed an unrelated run could read a registered host process's fixture output.

Refactor: carry an immutable caller scope from the adapter into execution. Scope process/browser/recording handles to their owner and grant explicit sharing when needed. Channel and scheduled runs need bounded capabilities appropriate to the originating request. Preserve documented schedule defaults until deliberately changing that contract; do not silently reinterpret stored empty lists during refactoring.

Acceptance: run B cannot enumerate/read/control run A's resources without a sharing grant; allowed group membership does not grant desktop-browser access; same-owner continuation works; child scope can only narrow its parent's grant.

### F4 — High: filesystem authorization is not bound to the accessed object

There are two related paths. General file tools authorize a canonical target, then later execute the original path after asynchronous approval/lock waits. A symlink or parent directory can change in that interval. A deterministic test swapped a selected symlink during lock acquisition: `read` returned bytes from an explicitly denied outside directory.

Wiki readers have a simpler containment gap: they enumerate `.md` names and use `readFile` without checking canonical containment. A fixture `wiki/leak.md` pointing outside the wiki was returned by `readWikiPage`. That tool is Plan-safe and bypasses the ordinary file-read policy; an existing malicious or accidental symlink is sufficient. Search/context/index readers repeat the pattern.

Evidence: [canonical targets](../src/main/agent/permissions/tool_permission_targets.ts#L24), [authorization/execution gap](../src/main/agent/runner/run_tool_call.ts#L139), [raw file read](../src/main/agent/tools/core/read.ts#L22), [wiki read](../src/main/agent/knowledge/wiki/wiki_read_page.ts#L21), [wiki context](../src/main/agent/knowledge/wiki/wiki_context.ts#L24).

Refactor: route file effects through a shared authorized filesystem boundary. Bind execution to a validated object/parent, revalidate after waits and immediately before effects, and define a symlink policy. Use descriptor-based/no-follow operations or an isolated filesystem executor where necessary; a second `realpath` alone is not a complete race defense. Apply equivalent containment to every compiled-wiki read path.

Acceptance: outside symlinks and path swaps cannot expose or mutate outside bytes; internal symlink behavior is explicit; denied paths stay denied across read/edit/patch/history/wiki routes; cancellation while waiting starts no file operation.

### F5 — Medium, potentially high impact: filesystem permission names overstate their scope

Workspace denies are deliberately removed, and exec grants deliberately imply read/write access independent of file-tool denies. Normal shell networking is unrestricted. Consequently, a blocked file-tool read is not a promise that shell execution cannot read the same data; the application also does not support protecting a subdirectory of its always-trusted workspace. A successful approved read remembers sibling access for that run. These are implemented choices, with UI/test support, rather than accidental missing checks.

Normal shell processes additionally inherit the entire application environment. If the launcher environment contains secrets, filesystem restrictions cannot prevent the command from observing those variables.

Evidence: [workspace normalization](../src/main/agent/permissions/with_workspace_permissions.ts#L5), [UI contract](../src/renderer/src/pages/settings/pages/permissions/Page.tsx#L112), [sandbox scope](../src/main/agent/sandbox.ts#L223), [environment inheritance](../src/main/agent/tools/core/bash.ts#L120), [read-directory reuse](../src/main/agent/context/context_remember_tool.ts#L9).

Refactor: define one effective filesystem contract shared by native tools and shell configuration. Keep workspace access as a default grant, with explicit deny precedence if protective subpaths are supported. Separate network policy and trusted helper environment from command environment. Approval UI must describe directory/run reuse and full shell authority. These semantic changes must be intentional and tested, without rewriting existing stored rules.

Acceptance: effective policy and UI agree for overlapping allow/deny rules, workspace subpaths, one-time reads and exec roots; explicit denies cannot be bypassed through another filesystem route; unrelated launcher secrets are absent from command environments.

### F6 — High: interruption and timeout do not reliably settle side effects

`runToolCall` races a tool against abort, then releases resource ownership even if the underlying tool is still running. File write/edit implementations do not consume the signal. A test confirmed a timeout released its lock before the test tool's later side effect completed.

Voice interruption only interrupts the provider connection; queued tools and approvals use the voice-session signal, so old-response actions can continue. A test confirmed a queued second tool ran after interruption. Default-mode shell cancellation and sandbox invalidation signal direct children; POSIX Plan cancellation already targets a process group and escalates. Invalidation stops waiting after two seconds and clears tracking without proving descendants stopped.

Evidence: [abort race](../src/main/agent/runner/run_tool_call.ts#L239), [write](../src/main/agent/tools/core/write.ts#L25), [voice interrupt](../src/main/agent/realtime_voice/manager.ts#L185), [voice tool signal](../src/main/agent/realtime_voice/tool_runtime.ts#L129), [process shutdown](../src/main/agent/sandbox.ts#L355).

Refactor: distinguish cancellation requested, execution settled and effect outcome unknown. Retain leases until settlement; supervise subprocess trees with bounded escalation; give voice responses their own cancellation/approval identity. If audio-only interruption remains useful, label it separately from cancelling actions. Ensure acquisition and initialization are inside cleanup ownership: MCP clients currently open before the runtime's cleanup `try/finally` begins.

Acceptance: interrupt prevents queued old-response effects; late operations cannot race a new conflicting owner; process-tree shutdown is verified on supported OSes; failures and early iterator return close acquired MCP clients exactly once; unknown remote outcomes are not retried as though no effect occurred.

### F7 — High for data integrity: voice and text can overwrite the same conversation

Voice opens an independent mutable snapshot for each window. Text serializes through the agent scheduler, while voice writes replace the complete session snapshot outside that scheduler. Two writers opening the same chat can erase each other's updates. The temporary fixture reproduced this with two voice writers. Clear/delete operations also need protection against later callbacks recreating state.

Evidence: [voice writer](../src/main/agent/realtime_voice/conversation.ts#L32), [window ownership](../src/main/agent/realtime_voice/manager.ts#L62), [text scheduling](../src/main/agent/agent.ts#L186), [snapshot persistence](../src/main/agent/session/session_persist.ts#L8).

Refactor: introduce one session coordinator/repository used by text, voice, history edits, clear and delete. Serialize short read/update/persist transactions or reject stale revisions; do not hold a session write lock across network streaming.

Acceptance: interleaved text and two voice windows preserve every update; stale callbacks cannot resurrect cleared/deleted chats; attachment/backup behavior and existing JSON formats remain intact.

### F8 — High for provider privacy; medium for limits: delegation loses the execution contract

Children receive tools, mode and limiters, but omit the parent's pinned provider/model/effort and aggregate budget. They fall back to global model settings, potentially sending delegated context to a different configured provider. Tool/paid/output counters start afresh; channel web limits key off `agentId === 'channels'`, while children use `subagent`. The parent receives only text, losing usage and most terminal status information. Existing child tool narrowing and nonrecursive delegation should be retained.

Evidence: [child context construction](../src/main/agent/runner/run_stream.ts#L206), [child input and return](../src/main/agent/tools/core/subagents.ts#L18), [global model fallback](../src/main/agent/runner/run_stream.ts#L120), [channel counters](../src/main/agent/runner/run_stream.ts#L328).

Refactor: pass a pinned execution context with root/parent/run identity, model configuration, capabilities, deadline and shared budget accounting. Return a structured child outcome containing usage, status and result references. Keep the existing local orchestration and concurrency controls.

Acceptance: changing global settings mid-run cannot reroute a child; all descendants consume the root budget; delegated channel web calls count toward the channel limit; cancellation/failure and consumption appear in the parent outcome.

### F9 — Medium: budget stops can lose completed results or allow more work

The executor emits `tool_call_end` before assigning `toolCall.result`. When the text runtime breaks on its output budget, iterator closure skips that assignment; an already executed result disappears. Other limits return after assistant calls are persisted, without terminal outcomes for unexecuted calls. Voice checks output size after executing but does not reject the next action after exhaustion. Both ordering and continued voice execution were reproduced.

Evidence: [result ordering](../src/main/agent/runner/run_tool_call.ts#L284), [budget break](../src/main/agent/runner/run_stream.ts#L370), [pre-execution return](../src/main/agent/runner/run_stream.ts#L312), [voice budget](../src/main/agent/realtime_voice/tool_runtime.ts#L151).

Refactor: finalize outcomes before publishing events; give each requested call exactly one terminal result, including skipped/cancelled; put budget admission and exhaustion state in the common executor.

Acceptance: the last executed result survives budget termination; every unexecuted call is marked as such; the first voice call after exhaustion has zero side effects; restored histories cannot imply that an unexecuted action succeeded.

### F10 — Medium: goal completion is self-asserted and final usage can disappear

`record_goal_evidence` accepts any source/summary and immediately marks a criterion satisfied. Completion checks those flags and evidence IDs, not a recorded observation. Accounting returns early for completed/blocked goals, so the finishing run's usage disappears; exceptions can bypass post-stream accounting. A fixture completed a goal with an invented reference and then retained zero usage after accounting.

Evidence: [evidence/completion tools](../src/main/agent/goal/tools.ts#L36), [accounting](../src/main/agent/goal/account.ts#L5), [accounting caller](../src/main/agent/agent.ts#L322).

Refactor: distinguish model assertions from verified observations or user attestations. Resolve evidence references against recorded outcomes and criterion-specific checks where available; do not pretend every natural-language goal has an automatic verifier. Account each admitted run once regardless of status and reserve remaining budgets before work. Aggregate reported usage exactly; record unavailable or estimated consumption explicitly when an interrupted provider stream supplies no final usage.

Acceptance: invented/failed references cannot satisfy a verified criterion; model-only claims remain labeled; completed, blocked, cancelled and errored runs retain usage; a status change cannot evade budget accounting.

### F11 — High when sensitive sources are selected: RAG disclosure and secret screening are incomplete

Consent is bound to the embedding provider/model, but indexing additionally uploads plaintext chunks and path metadata to Pinecone. The UI mentions the mirror in help, yet the consent wording only authorizes sending chunks to the embedding provider and a nearby description says documents are stored locally. Query embedding is another remote disclosure. This is an incomplete data-flow contract, not a wholly hidden integration.

The shared source-secret check rejects assignment syntax but misses ordinary quoted JSON credential keys and recognizable bare tokens. Fake-token probes demonstrated both gaps. Depending on the ingestion path, accepted source text reaches embedding/remote storage or wiki generation; wiki also has its own source-extension filter.

Evidence: [consent guard](../src/main/agent/knowledge/rag/rag_index.ts#L35), [plaintext mirror](../src/main/agent/knowledge/rag/rag_index.ts#L153), [UI disclosure](../resources/i18n/en/main.json#L1478), [query embedding](../src/main/agent/knowledge/rag/rag_search.ts#L28), [screening](../src/main/agent/knowledge/safety.ts#L4).

Refactor: explicitly authorize each configured data recipient and content class; inject the remote mirror adapter and correct disclosure. Screen structured credential fields and common token forms before archive/network writes, reuse appropriate memory screening, and define source exclusions. Screening reduces accidents; it cannot prove arbitrary text contains no secrets.

Acceptance: no destination receives data without its applicable grant; changed recipient/account/model triggers the appropriate review; quoted JSON credentials, keys and common tokens result in zero archive/embed/mirror/generation calls; benign text remains indexable.

### F12 — Medium: ingestion and retention are insufficiently bounded

RAG recursively materializes file names, reads complete files before deciding whether they are text, and retains the corpus/vectors in memory. There are no effective aggregate file/byte bounds, and cancellation does not interrupt source reads. Each index attempt uses a new remote namespace; partial failures and previous generations are not cleaned up by this path, though explicit purge functionality exists. Session history, attachment blobs and local knowledge also need an explicit retention/access contract; semantic trace redaction does not remove private content from conversation storage.

Evidence: [source collection](../src/main/agent/knowledge/rag/source.ts#L9), [corpus accumulation](../src/main/agent/knowledge/rag/rag_index.ts#L46), [cleanup](../src/main/agent/knowledge/rag/rag_index.ts#L148), [remote purge](../src/main/data/data_purge_remote.ts#L3), [session storage](../src/main/agent/session/session_persist.ts#L8).

Refactor: bounded cancellable source iteration and incremental indexing; explicit staging/published generation ownership and retention; remove only failed staging generations owned by the operation under an approved cleanup policy. Define private file permissions, retention, inspection/export and deletion for new artifacts without silently rewriting or deleting existing user data.

Acceptance: oversized files are rejected before full allocation; file/corpus/time limits bound memory and work; interrupted uploads preserve the published index and clean only their own staging data; local and remote deletion behavior is documented and tested.

### F13 — Medium: imported skill text outranks parts of the core prompt under pressure

Skills are marked user-controlled, yet their full instructions are appended to system instructions and preserved as protected system content. Context budgeting can truncate the ordinary system prompt to its first 1,536 characters while retaining that skill content. This is a verified placement/retention weakness, not a demonstrated model jailbreak. Deterministic tool authorization remains the actual security boundary.

Evidence: [skill trust](../src/main/agent/skills/skills_read.ts#L50), [instruction insertion](../src/main/agent/system/system_add_skill_prompt.ts#L16), [protected context](../src/main/agent/runner/run_stream.ts#L257), [context truncation](../src/main/agent/runner/run_model_context_budget.ts#L111).

Refactor: preserve the complete immutable core contract; place activated skill instructions in clearly scoped subordinate context. Retain activation records, hashes, resource restrictions and tool-set intersection. Evaluate malicious skill/tool/wiki content without relying on prompt wording to enforce permissions.

Acceptance: context pressure never removes the core policy; conflicting skill content cannot expand executable capabilities; direct and indirect prompt-injection fixtures produce zero prohibited effects.

## Refactoring plan — in place, without migration

Keep the existing provider adapters, local orchestrator, scheduler and persisted formats. No database/schema conversion, history import, replacement agent framework, dual runtime or automatic rewrite of stored settings is required. New runtime objects can be introduced within current modules. Any additive configuration for consent or explicit grants should be read safely when absent and saved only through the ordinary user settings flow.

| Order | Work and principal files                                                                                                                                              | Completion gate                                                                                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Characterize F1–F13 in focused regression tests; correct the existing tests that encode ignored approvals. Record current UI/schedule/workspace semantics.            | Tests demonstrate each defect or mark the evidence as static/conditional; no unrelated behavior is changed.                                                                   |
| 2     | Repair MCP approval and the file/wiki access paths directly (`tools/mcp`, `permissions`, `tools/core`, `knowledge/wiki`).                                             | F1/F4 acceptance checks pass; no external connector call or outside file access precedes authorization.                                                                       |
| 3     | Introduce required tool/action capability descriptors and a pure authorization function; thread caller scope through UI/channels/tasks/voice/children; scope handles. | F2/F3/F5 checks pass across every entry point; missing metadata fails closed; UI reflects effective grants.                                                                   |
| 4     | Refactor executor settlement, immutable outcomes, resource cleanup and process supervision; add response cancellation for voice.                                      | F6/F9 checks pass with late completion, lock contention, repeated interrupt and early iterator closure.                                                                       |
| 5     | Put text/voice/history mutations behind one session coordinator using existing JSON persistence.                                                                      | F7 concurrent-writer, clear/delete and recovery tests pass without data conversion.                                                                                           |
| 6     | Carry pinned model/capability/deadline/budget context into children and voice; bind goal evidence and accounting to run outcomes.                                     | F8/F10 checks pass; reported root usage aggregates exactly across terminal states and delegation; unavailable consumption is explicit and budget reservations are reconciled. |
| 7     | Refactor knowledge ingestion around authorized sinks, safe bounded readers and owned generations; fix skill/core context priority.                                    | F11/F12/F13 checks pass; no unauthorized uploads, unbounded fixture reads, or capability expansion from content.                                                              |
| 8     | Run the cross-entry-point permission suite and real OS/runtime smoke checks; update user-facing permission/data-flow documentation.                                   | All relevant gates below pass; remaining conditional risks are explicitly recorded.                                                                                           |

Implement cohesive modules for authorization, execution context/budgets, session ownership and authorized filesystem access only where responsibilities already cross callers. Inject stores, model/sink adapters, clock and resource registries at those boundaries. Keep one function per new file and short filenames under the repository's conventions. Do not mass-rename the existing function-per-file tree or move code solely to reduce file length.

The runtime after refactoring should follow: admit caller and immutable scope → resolve capabilities/model → reserve budget → validate and authorize action → acquire/verify resources → execute and settle → persist outcome → emit event → verify progress or terminate. Policy must be enforced again at the effect boundary when mutable resource identity or policy may have changed during a wait.

### Verification and release gates

- Exercise UI, channel, task, child, parallel child, voice and Plan routes against the same authorization matrix: deny precedence, missing grant, ownership mismatch, stale/replayed approval, unavailable UI, cancellation and budget exhaustion.
- Real macOS/Linux/Windows smoke tests must establish file/symlink boundaries, helper environment isolation, sandbox unavailability behavior, process-tree termination, denied network destinations, and explicit host execution. Mocked configuration tests cannot prove OS enforcement.
- Concurrency tests must interleave writers and delayed effects, rather than only assert that abort signals were dispatched.
- Remote adapter tests must inspect outbound payloads and invocation counts using fake credentials. Provider failure/timeout must preserve unknown-effect status and prevent unsafe duplicate retries.
- Knowledge tests must cover source limits, rejected secrets, recipient consent, partial publication and scoped cleanup; session tests must preserve backup/attachment recovery.
- Run `npm run test:main -- --runInBand`, `npm run typecheck:node`, affected renderer tests/typecheck, and lint/build checks appropriate to each implementation change. Retain a code rollback point; no data rollback/migration should be necessary. Do not re-enable an unsafe tool merely to make rollback easier.

## Evidence collected and limits

- `npm run test:main:agent -- --runInBand`: **261 suites and 1,099 tests passed**. This invocation selected the full main project in the current Jest CLI configuration; listing confirmed 105 agent suites and one integration suite among those 261. Do not describe all 1,099 as agent-only tests.
- `npm run typecheck:node`: **passed**.
- Temporary tests under `/private/tmp/kucedr-runtime-review`: **9 checks passed asserting current defective behavior**: stale voice writers, fabricated goal evidence/final accounting, result ordering, timeout lease release, voice interruption, voice output exhaustion, path-swap read, cross-run process output and directory read reuse. These are diagnostic reproductions, not passing security acceptance tests, and were not added to the repository.
- Additional isolated probes used fake data to demonstrate wiki symlink reads and missed JSON/bare-token screening. No real provider calls, recordings, messages or sensitive-file reads were needed.
- The existing tests mock Electron and several integrations; sandbox permission tests mock the runtime. No full packaged-app, real connector, cross-platform sandbox, dependency-vulnerability, performance/load or live model adversarial assessment was completed.
- Arbitrary command environment reaches the Plan helper bootstrap in source, but a direct local Electron-binary marker probe did **not** execute the injected bootstrap marker. A Node launcher probe is not evidence of an Electron sandbox escape. Packaged/platform helper behavior remains an explicit verification item; no confirmed OS sandbox escape is claimed here.
- Session files contain private conversation content by design; this review does not establish encryption/access guarantees for every storage backend or OS backup. A2A/MCP safeguards were inspected and covered by the existing suite, not tested against hostile live servers.

The recommendations align with deterministic tool authorization and scoped agent authority in [OWASP's AI Agent Security guidance](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html), and sender validation/context isolation in [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security). These are reference criteria; each finding above is grounded in repository evidence.
