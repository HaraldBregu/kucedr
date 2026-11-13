# Agent Skills — Loading Analysis & Refactoring Plan

> **Status:** proposal, 2026-11-13. Related: [AGENT_TOOLS.md](AGENT_TOOLS.md), [TOOL_SELECTION.md](TOOL_SELECTION.md), [PROMPT_CACHE.md](PROMPT_CACHE.md). Line numbers are from `dev` at `04b9abeea7`.

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

### Phase 3 — Single source of truth (S6, S8, S9)

6. **One registry for both the UI and the agent.**
   - `list()` becomes `createSkillRegistrySnapshot().skills`.
   - `resolveSkillFolder` looks up `folderPath` in the snapshot.
   - Delete `scan.ts`, `skills_list_skills.ts`, `skills_command.ts` and `skills_activate.ts`. `load_skill` calls `inspectSkill` directly.
   - Delete `runningSkill()` unless a caller is planned.
   - → verify: the Settings → Skills list equals `list_skills` output for the same state, and delete/download work for plugin and user skills.
7. **Hash check:** compare against the file read at activation and drop the snapshot hash. Or re-snapshot and retry once before failing.
8. **Remove the unused `loadedSkills` parameter** from `buildSystemPrompt`/`addSkillPrompt`. Injection already happens through `buildLoadedSkillPrompt`, so `addSkillPrompt` only needs the "Skills" usage note.

### Phase 4 — Discovery (S5), needs product decision

The gate is explicit-only on purpose (`system_add_skill_prompt.ts:13`). Two options:

- **A (recommended):** keep it explicit-only, but replace the regex with `/skill` plus a skill chip in the composer. Tool exposure is then deterministic and cache-stable. `list_skills` becomes UI-only.
- **B:** follow the spec's progressive disclosure. Always list `name: description` in the system prompt, always expose `load_skill`, and drop the regex. This costs about 30 tokens per skill per request. The model can then pick a skill on its own.

## Not changing

- `skills_import.ts` staging and validation, `skills_validate_package.ts` and `skills_resolve_resource.ts`: the path-escape and size checks are sound.
- Subagents not receiving `load_skill`. Revisit only if a skill needs to delegate.
