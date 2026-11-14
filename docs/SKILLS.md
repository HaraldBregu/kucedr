# Agent Skills — Loading Analysis & Refactoring Plan

> **Status:** Phases 1–3 implemented on 2026-11-14. Phase 4 is open and needs a product decision. Two deviations from the plan:
> - The step 5 snapshot cache was skipped. With the workspace root removed, the scan is one `readdir` per root, so a cache isn't needed yet. Add one if it ever shows up in a trace.
> - Pinned skills are stamped as `skillIds` on assistant messages, the same way `modeIds` is, because sessions have no metadata file. On each run the latest stamp is read back.
>
> Original proposal: 2026-11-13. Related: [AGENT_TOOLS.md](AGENT_TOOLS.md), [TOOL_SELECTION.md](TOOL_SELECTION.md), [PROMPT_CACHE.md](PROMPT_CACHE.md). Line numbers are from `dev` at `04b9abeea7`.

## How a skill reaches the agent today

1. **Command parsing** (`agent.ts:260`, `skills_parse_command.ts`): `/skill <name> <text>` becomes `explicitSkill = name`, and the message becomes `<text>` (or a placeholder).
2. **Gate** (`run_stream.ts:183-197`): skill tools are enabled only when `requestsSkillTools` (`run_skill_request.ts`) matches a regex like "use … skill" in any user message, when `explicitSkill` is set, or when the history already holds a `kind: 'skill'` message. Settings and allow/deny lists still apply through `toolIdEnabled`.
3. **Registry** (`skills_registry.ts`): when the gate is open, `createSkillRegistrySnapshot({ projectRoot: config.location })` scans three roots in priority order:
   - project: the workspace folder
   - user: `~/.kucedr/skills`
   - plugin: `pluginDirs('skills')`

   The scan is recursive, up to depth 12 (`scan.ts`). A duplicate name is shadowed, and the higher-priority root wins.
4. **Tools** (`run_stream.ts:259-263`): `list_skills` (names and descriptions) and `load_skill` (`z.enum` of names). Both are put in `requiredIds`, so they are always active.
5. **Activation** (`skills_activate.ts` → `skills_inspect.ts`): the skill is validated again and its SHA-256 is compared with the snapshot. Then the frontmatter is stripped and the resources are listed. `applyActivatedSkill` (`run_stream.ts:246`) pushes `allowedTools` onto `skillToolScopes` and calls `rememberSkill` on `session.runContext`.
6. **Injection** (`run_stream.ts:499-507`): newly loaded skills are added as an internal user message (`kind: 'skill'`) with `<skill_content>` and `<instructions>`, built by `system_add_skill_prompt.ts`. The message is persisted with the session.
7. **Enforcement** (`run_stream.ts:685-693`): `selectSkillTools` intersects all scopes, and any call outside the result is skipped with "The loaded skill does not allow this tool."
8. **Subagents** (`subagents.ts:185`): children never get `load_skill` and never see the parent's skill instructions.

The UI path is separate. Settings → Skills uses `list()` (`skills_list.ts`), a top-level-only scan of the user and plugin roots, and `loadSkill()` (IPC `skills.load`) for the details page.

## Findings

| # | Sev | Finding | Where |
|---|---|---|---|
| S1 | **High** | **`allowed-tools` has the wrong meaning and the wrong id space.** In the Agent Skills spec, `allowed-tools` is a list of *pre-approved* tools in Claude-style names (`Bash(git:*) Read`). Here it is a hard *allowlist* matched against our ids (`bash`, `read`). Any skill that follows the spec and declares `allowed-tools` therefore blocks **every** tool except `load_skill`, and the run can do nothing. Loading a second skill narrows the set further, because the scopes are intersected. | `skills_read.ts:27-30`, `run_skill_tools.ts`, `run_stream.ts:685` |
| S2 | **High** | **Skill state does not carry over to the next run.** `createSessionState()` builds a fresh `runContext` on every run (`agent.ts:234`), but the `kind: 'skill'` instruction message stays in the history. On the next turn the model still follows the skill, but `allowed-tools` is no longer enforced and `skillActivations` in `run_started` is empty. `runningSkill()` returns `undefined`. If the user runs `/skill X` again, a second copy of the instructions is injected. | `run_stream.ts:236,464,499`, `agent.ts:234` |
| S3 | **High** | **The workspace is a skill root, and every skill is labelled `trust: 'user-controlled'`.** Any `SKILL.md` up to 12 levels deep under the workspace can be loaded. That includes cloned repos, downloaded archives and files the agent wrote itself. Its text is then injected as "protected instructions", and it shadows a user skill with the same name. `readSkill` hard-codes `source: 'local-filesystem'` and `trust: 'user-controlled'` for all three scopes. | `run_stream.ts:201`, `skills_registry.ts:24-28`, `skills_read.ts:49-50` |
| S4 | Med | **Synchronous recursive scan on the main process.** When the gate is open, `scanSkillFolders(workspace)` walks up to depth 12 with `readdirSync` and validates every hit two or three times. Each validation does a `realpath` and a read. Once a session holds a skill message, the gate stays open (S5), so this scan runs on **every** later run. A large workspace freezes Electron's main thread. | `scan.ts`, `skills_registry.ts:30-44` |
| S5 | Med | **Keyword gate with sticky state.** `requestsSkillTools` matches phrases like "what skills do I need for a PM role". Once a `skill` message is in the history, `list_skills`/`load_skill` stay active for the rest of the session. This adds tool-schema churn and cache misses (PROMPT_CACHE.md #3). Without the keyword, the model never learns that skills exist. | `run_skill_request.ts`, `run_stream.ts:184-191` |
| S6 | Med | **The UI and the agent use two different discovery algorithms.** `list()` reads top-level folders of the user and plugin roots and deduplicates by id. The registry scans recursively, adds the project root, and deduplicates by name. So a skill can show in Settings but load from a different folder (project shadowing), and a nested skill can load in chat but never show in Settings. `resolveSkillFolder` (delete/download) is top-level only. | `skills_list.ts`, `skills_registry.ts`, `skills_resolve_folder.ts` |
| S7 | Low | **An unknown `/skill` name fails the whole run.** A typo throws "was not found in this run's registry" before any model turn. So does any explicit skill when `load_skill` is denied in settings ("Skill loading is unavailable"). The user gets an error instead of a reply. | `run_stream.ts:368-373` |
| S8 | Low | **A mid-run edit fails activation with a misleading message.** The snapshot hash is taken at run start. Editing `SKILL.md` before the model calls `load_skill` gives "changed while it was loading". | `skills_inspect.ts:39-41` |
| S10 | **High** | **A skill silently disappears in long chats.** Its instructions exist only as one internal message in the turn where the skill was loaded. When the history is over budget, `fitModelContext` keeps only the latest user turn plus whatever older turns fit (`run_model_context_budget.ts:72-126,190+`). Compaction summarizes everything older than 8 user turns (`compaction/compact.ts:51-57`). Either way the skill text is dropped. The sticky gate in `run_stream.ts:188` then fails too, so `load_skill` disappears as well. The model drifts off the skill with no signal. | listed |
| S11 | Low | **About 150 lines of unused shared code**, re-exported through `shared/index.ts`:<br>• in `skills_definitions.ts`, the whole file: `SKILL_CATEGORIES`, `toAnthropicSkills`, `toOpenAIHostedSkills`, `toOpenAILocalSkills`, `resolveSkillAttachments`<br>• in `skills_types.ts`: `SkillSearch*`, `SkillSupportFile`, `SkillDetails`, `SkillFrontmatter`, `SkillValidationResult.skill`, `SkillManifest.id`, the `Anthropic*`/`OpenAI*` types, `SkillAdapterTarget`, `ResolvedSkillAttachment`<br>• `SkillInfo.location`, which duplicates `folderPath`<br>• `structure.kind`, which is always `'direct'` | `src/shared/skills_*.ts` |
| S12 | Low | **Diagnostics never reach the user.** `SkillInfo.diagnostics` is never set, so the details page's diagnostics block (`details/Page.tsx:223`) never renders. Registry diagnostics (invalid or shadowed skills) only go into the trace as a count (`session_trace_entry.ts:30`). An invalid skill just vanishes from Settings. Also, the budget error message still mentions "active skill instructions" (`run_model_context_budget.ts:142`), but skills no longer travel in `protectedSystemPrompt`. | listed |
| S9 | Low | **Dead or duplicated code.** `resolveSkillCommand` (`skills_command.ts`) and `listSkills` (`skills_list_skills.ts`) are exported but never called. `runningSkill()` (`agent.ts:584`) is never called. `activateSkill` repeats `inspectSkill`'s lookup and then calls it. `loadSkill` does the same. `buildSystemPrompt` receives `loadedSkills` (`run_stream.ts:489`) but passes `[]` to `addSkillPrompt` (`system_build_prompt.ts:28`). `validateSkill` runs 3× per skill per run: registry, `readSkill`, `inspectSkill`. | listed |

## Plan

Do the phases in order. Each phase is shippable on its own.

### Phase 1 — Correctness (S1, S2, S7, S10)

1. **`allowed-tools` → display-only for now.**
   - Delete `selectSkillTools` (`run_skill_tools.ts`), `skillToolScopes` and the `skillBlocked` gate (`run_stream.ts:236,247,685-693`).
   - Keep the parsed value on `SkillInfo.manifest` so the details page can show it.
   - Spec-style pre-approval should come later, and only after Phase 2. The hook point is the permission resolution in `run_tool_call.ts:300`: an `ask` becomes `allow` for mapped ids. But pre-approval lets a skill author bypass the `bash` prompt, so it must be limited to the user and plugin roots, and it needs a name map such as `Bash(...)→bash` and `Read→read`.
   - → verify: a skill with `allowed-tools: Bash(git:*) Read` can call `write`, and the approval prompts are unchanged.
2. **Pin loaded skills to the session instead of to one turn.** This replaces the plan's earlier idea of rebuilding skills from history, because history can be trimmed or compacted (S10).
   - Persist `loadedSkills: {id, hash}[]` in the session metadata, next to `modeIds`.
   - At run start, re-read each skill with `inspectSkill`, then send the instructions in `requiredContextMessages`, which `fitModelContext` never drops. Stop writing the `kind: 'skill'` history message.
   - The sticky gate (`run_stream.ts:188`) then checks `loadedSkills.length > 0`.
   - `applyActivatedSkill` skips a skill that is already loaded. If the hash changed, it replaces the stored copy.
   - Sessions that already hold `kind: 'skill'` messages: read them once into the metadata on load, and leave the old message in place. No migration is needed.
   - → verify: `/skill pdf` in run 1, then 10 plain turns and a manual compaction. The next run's request still contains the `pdf` instructions exactly once, and `run_started.skillActivations` lists `pdf`.
3. **Soft-fail unknown or unavailable explicit skills.** Don't throw. Add an internal note like "Skill "X" not found; available: …", and let the model answer.
   - → verify: `/skill pfd hello` streams a reply that names the valid skills.

### Phase 2 — Trust and performance (S3, S4)

4. **Drop the implicit project root.**
   - Remove `projectRoot: config.location` from `run_stream.ts:201` and the `project` scope from the registry.
   - If workspace skills are wanted later, use one fixed folder (`<workspace>/.skills`), keep it top-level only, and label it `trust: 'workspace'`.
   - Set `source`/`trust` from the scope instead of hard-coding them in `readSkill`.
   - → verify: a `SKILL.md` placed at `<workspace>/repo/x/SKILL.md` is not offered by `load_skill`.
5. **One scan, top-level, cached.** Replace `scan.ts` with the `list()` top-level walk. Cache the snapshot keyed on the `mtimeMs` of each root, and invalidate it on import/delete or a plugin change. `readSkill` returns the validation result, so the registry stops validating twice.
   - → verify: with 5 skills, a second run does no `readdirSync` of the roots, which you can confirm with a log/trace.

### Phase 3 — Single source of truth (S6, S8, S9, S11, S12)

6. **One registry for both the UI and the agent.**
   - `list()` becomes `createSkillRegistrySnapshot().skills`.
   - `resolveSkillFolder` looks up `folderPath` in the snapshot.
   - Delete `scan.ts`, `skills_list_skills.ts`, `skills_command.ts` and `skills_activate.ts`. `load_skill` calls `inspectSkill` directly.
   - Delete `runningSkill()` unless a caller is planned.
   - → verify: the Settings → Skills list equals `list_skills` output for the same state, and delete/download work for plugin and user skills.
7. **Hash check:** compare against the file read at activation and drop the snapshot hash. Or re-snapshot and retry once before failing.
8. **Remove the unused `loadedSkills` parameter** from `buildSystemPrompt`/`addSkillPrompt`. Injection already happens through `buildLoadedSkillPrompt`, so `addSkillPrompt` only needs the "Skills" usage note.
9. **Delete the unused shared code (S11).** Remove `skills_definitions.ts` and its export from `shared/index.ts`. Remove the unused types and fields listed in S11.
   - → verify: `npm run typecheck` passes with no other edits.
10. **Surface diagnostics (S12).** Attach the registry's per-skill diagnostics to `SkillInfo.diagnostics`, including invalid folders as entries, so Settings shows why a skill is missing. Change the budget error text to "mode instructions".
   - → verify: a skill folder with a bad `name` shows in Settings with its error.

### Phase 4 — Discovery (S5), needs product decision

The gate is explicit-only on purpose (`system_add_skill_prompt.ts:13`). Two options:

- **A (recommended):** keep it explicit-only, but replace the regex with `/skill` plus a skill chip in the composer. Tool exposure is then deterministic and cache-stable. `list_skills` becomes UI-only.
- **B:** follow the spec's progressive disclosure. Always list `name: description` in the system prompt, always expose `load_skill`, and drop the regex. This costs about 30 tokens per skill per request. The model can then pick a skill on its own.

## Second review (2026-11-14, after Phases 1–3)

I re-read the code after the refactor. These findings are new. Several are side effects of pinning skills to the session.

| # | Sev | Finding | Where |
|---|---|---|---|
| R1 | **High** | **The agent cannot read a skill's own files without asking.** Skill roots sit under `~/.kucedr` (the user root and plugin folders). The default allow-list only covers the workspace (`with_default_permissions.ts`). So every `read` of a skill's `references/…` file and every `bash` call to its `scripts/…` asks for approval. "Always allow" can't be saved either, because the path counts as a broad target (`broad.ts:12`, `resolve_tool_permission.ts:119`). In the `tasks` profile the fallback is `deny` (`run_tool_call.ts:88`), so scheduled tasks can't use a skill's resources at all. | listed |
| R2 | Med | **A pinned skill can't be seen or unloaded.** After Phase 1, a loaded skill stays loaded for the whole session. The renderer ignores `run_started.skillActivations` and `Message.skillIds`, and no command removes a skill. The user can't tell which skills are active, and the only way out is a new chat. | `run_stream.ts:390`, renderer |
| R3 | Med | **An oversized pinned skill breaks the session.** Skill text is a required message, so it is never trimmed. `SKILL.md` may be up to 256 KB (about 85k tokens, `skills_limits.ts:2`), and the 5k-token guideline is only a warning. A large skill, or a later switch to a small-context model, makes `fitModelContext` throw on every run of that session. The error message mentions "mode instructions" or "workspace context", not the skill. | `run_model_context_budget.ts:140-146` |
| R4 | Low | **An empty skill list can't be recorded.** `skillIds` is stamped only when it's non-empty (`session_add_assistant_message.ts`). If a pinned skill is deleted from disk, the older stamp is found again and retried, silently, on every run. This also blocks unloading (R2). | `session_add_assistant_message.ts`, `run_skill_ids.ts` |
| R5 | Low | **Frontmatter validation is too strict.** Any unknown key rejects the whole skill (`skills_validate.ts`, `unknown-field`). That includes common keys from other skill ecosystems such as `when_to_use`, `argument-hint`, `model` or `version`. A non-string metadata value (`metadata: { version: 1.0 }`, which YAML reads as a number) also rejects it. The 5 installed skills pass, but imported third-party skills often won't. | `skills_validate.ts` |
| R6 | Low | **One odd entry blocks loading.** `listSkillResources` throws on a symlink to a directory inside the skill (`statSync().isFile()` is false). It also throws on any link that escapes the root, so the whole skill fails to load. `validateSkillPackage` only screens imports, not plugin or hand-copied skills. | `skills_resources.ts`, `skills_resolve_resource.ts:27` |
| R7 | Low | **`/skill` has no UI.** The composer gives no hint or autocomplete. After a reload, the history shows only the stripped text, or the placeholder "Use the explicitly selected skill.", because `agent.ts:275` saves the parsed message. | `skills_parse_command.ts`, `agent.ts:260-275` |
| R8 | Low | **Delete and download can pick the wrong folder.** If a broken user folder and a valid plugin skill share an id, Settings shows the plugin skill, but delete and download act on the broken user folder (`skills_resolve_folder.ts` checks the user root first). | `skills_resolve_folder.ts` |
| R9 | Low | **Leftovers:**<br>• `SkillTrust` has one value (`'user-controlled'`) but still travels through the prompt JSON, `run_started`, the trace and the details page.<br>• `structure.format/standard` are constants.<br>• `loadSkill` repeats `inspectSkill`'s lookup.<br>• Each load validates and reads `SKILL.md` twice (`readSkill` in the registry, then `inspectSkill`). | listed |

Checked and fine:
- path containment and import staging
- the legacy `kind: 'skill'` migration
- pinned skills surviving trimming and compaction
- run_stream's handling of the peer session's tool-pipeline changes

### Phase 5 — Follow-ups from the second review

> **Status:** R1–R6, R8 and R9 implemented on 2026-11-14. R7 waits on Phase 4. Corrections and changes against the plan below:
> - **R1 is Low, not High.** In the `chat` profile, `read` is already allowed anywhere (`resolve_tool_permission.ts`, `kind === 'read' && fallback !== 'deny'`). Only `tasks` runs were blocked. The fix is a global, read-only allowance for the skill roots (`permissions/skill_target.ts`), not a per-run grant. Script execution still prompts.
> - **R2:** the chips update when the next run starts (`run_started.skillIds`) and when history loads. A skill that the model loads mid-run shows up on the next message, not right away.
> - **R9:** `trust` is removed, along with its row on the details page and its i18n keys. `structure` stays, because the details page still shows its format.

1. **R1, read grant for loaded skills.** For the current run, add each loaded skill's `canonicalRoot` to the read allow-list, read-only. Pass the roots through the `security` context into `resolveToolPermission`. Script execution keeps prompting, because running a skill's code needs the user's approval.
   - → verify: after `/skill pdf`, `read` of `references/forms.md` runs without a prompt. A `tasks` run can read it too. `bash scripts/x.py` still asks.
2. **R4, then R2: unload and visibility.**
   - Stamp `skillIds` on every assistant message whenever the session has pinned skills, including `[]`. `pinnedSkillIds` treats `[]` as the answer.
   - Show the active skills as chips from `run_started.skillActivations`, using the existing Badge component.
   - Clicking a chip's × sends a `/skill off <name>` command, which `parseSkillCommand` handles by dropping the id.
   - → verify: load, unload, then the next run has no skill context, and the history stamp is `[]`.
3. **R3, size guard.**
   - At activation, refuse a skill whose estimated tokens exceed a quarter of the model's context window. Tell the model why, using the same soft-fail note as an unknown skill.
   - Change the budget error text to "skill instructions" when `requiredContextMessages` is non-empty.
   - → verify: a 200 KB `SKILL.md` gives a reply that explains the refusal, not a run error.
4. **R5, lenient frontmatter.** Turn `unknown-field` into a warning. Coerce scalar metadata values to strings.
   - → verify: a skill with `when_to_use:` and `metadata: {version: 1.0}` imports and loads, and the warning shows in Settings.
5. **R6.** In `listSkillResources`, skip directory links and escaping links and add a warning, instead of throwing.
6. **R8 and R9.**
   - Resolve delete/download through the registry entry the UI shows (`list()` → `folderPath`).
   - Drop `SkillTrust` and `structure`.
   - Have `inspectSkill` return `undefined` for a missing skill, so `loadSkill` becomes one line.
7. **R7** belongs with the Phase 4 decision, as part of the composer skill chip.

## Not changing

- `skills_import.ts` staging and validation, `skills_validate_package.ts` and `skills_resolve_resource.ts`: the path-escape and size checks are sound.
- Subagents not receiving `load_skill`. Revisit only if a skill needs to delegate.
