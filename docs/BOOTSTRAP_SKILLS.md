# Skills for the bootstrap plugin

> **Status:** Catalogue only, written 2026-11-18. No skill from this list is built yet. Related: [SKILLS.md](SKILLS.md), [PLUGIN_SCRIPTS.md](PLUGIN_SCRIPTS.md), [AGENT_MODES.md](AGENT_MODES.md), [APPS.md](APPS.md).

## Context

`resources/plugins/bootstrap/skills/` holds four skills today: `docx`, `pdf`, `pptx`, `xlsx`. This document lists what else belongs there.

A skill here is a folder with a `SKILL.md` (agentskills.io format) plus optional resource files. It loads only when the user asks for it (`/skill <name>` or "use the X skill"), and its instructions are then pinned to the session. That shapes what makes a good one:

| Put it in | When |
|---|---|
| **Skill** | A multi-step procedure for one kind of task, driven with tools the agent already has (`bash`, `read`/`write`, `search_web`, `use_web_browser`, tasks, knowledge, media) |
| **Mode** (`modes/`) | A behaviour or tone for the whole chat (plan, short, factchecker) |
| **Script** (`scripts/`) | A new tool or renderer the model calls (chart, draw, maps) |

## Skill types, ranked

1. **Kucedr authoring skills** — highest value, because nobody else can ship them. Each teaches the agent one of our own package formats, drawn from the existing docs.
   - `skill-creator` — write a valid `SKILL.md` package into `~/.kucedr/skills` (limits from `src/main/agent/skills/skills_limits.ts`)
   - `plugin-creator` — scripts, modes, apps and themes with their manifests (`docs/PLUGIN_SCRIPTS.md`, `docs/AGENT_MODES.md`, `docs/APPS.md`)
   - `mcp-builder` — scaffold a local stdio MCP server and register it
2. **Research and writing workflows** — pure instructions, no runtime needed.
   - `deep-research` — plan, fan out `search_web`/`fetch_web_page` through subagents, write a cited report
   - `doc-coauthoring` — outline, draft, reader-test loop for long documents
3. **File and media formats beyond Office** — same family as the current four.
   - `media` — convert, trim, resize and extract with ffmpeg and ImageMagick
   - `data` — explore and clean CSV/JSON/SQLite, then hand results to the `chart` script
4. **Developer workflows**
   - `code-review`, `webapp-testing` (drives `use_web_browser`), `frontend-design`
5. **Assistant routines tied to app features**
   - `weekly-review` (tasks + memory + `HEALTH.md`), `inbox-triage` and `calendar-planning` once Gmail/Calendar are fully wired

**First batch:** `skill-creator`, `deep-research`, `media`. One per type, each testable without credentials.

**Skip:** tone or persona skills (those are modes), anything that only renders output (those are scripts), and thin wrappers around a single tool call.

## Constraints to design around

- Loading is explicit, so the folder name must be something a user would type. One word, lower-case, equal to the `name` in the frontmatter.
- `SKILL.md` should stay under 500 lines / ~5k tokens; push detail into sibling `.md` files the skill links to.
- Subagents never see skill instructions, so a skill that delegates must put the needed rules in the subagent prompt.
- `allowed-tools` is display-only.
- The current four need Python and `pip`/`npm` installs on the user's machine. New skills should prefer instructions only, or tools the app already provides.

## Licence issue in the existing four

Each of `docx`, `pdf`, `pptx`, `xlsx` ships Anthropic's `LICENSE.txt`, which forbids copying, derivative works and distribution outside Anthropic's services. Bootstrap is published at `Kucedr/kucedr-plugins`, so these should be replaced with our own versions or with the Apache-2.0 skills from `anthropics/skills` (`skill-creator`, `mcp-builder`, `webapp-testing`, `frontend-design` and others are Apache-2.0 and can be adapted with attribution).

## Verification (per skill, when one is built)

1. Settings → Skills lists it under Bootstrap with no diagnostics.
2. `/skill <name> <task>` in a chat loads it and the agent follows the procedure end to end.
