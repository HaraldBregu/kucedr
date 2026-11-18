---
name: skill-creator
description: Create, fix or improve a Kucedr agent skill - a folder with a SKILL.md and optional reference files, scripts and assets under ~/.kucedr/skills. Use when the user asks to make a new skill, turn a repeated workflow or set of instructions into a skill, edit or debug an existing skill, or find out why a skill is missing from Settings or fails to load.
license: MIT
---

# Skill creator

A skill is a folder of instructions that Kucedr adds to a chat on request. You write the folder; the app validates and lists it. Follow the steps in order.

## How skills behave in Kucedr

Know these rules before you design anything:

- A skill loads only when the user asks for it: `/skill <name> <request>`, or a message such as "use the <name> skill". A request that merely matches the description does not load it. Tell the user the exact command when you finish.
- Once loaded, the skill stays pinned to that chat until the user sends `/skill off <name>`. Its whole body is sent with every later request, so every line costs tokens for the rest of the chat.
- Subagents never see skill text. If a workflow delegates with `subagent`, the skill must tell the reader to put the needed instructions into the subagent prompt.
- `allowed-tools` is display-only. It does not grant, restrict or pre-approve any tool. Leave it out.
- Files in the skill folder can be read without an approval prompt. Running a script from the folder with `bash` still asks the user.
- A user skill in `~/.kucedr/skills` shadows a plugin skill with the same name. To customise a bundled skill, copy its folder there under the same name and edit the copy.

## Step 1: Pin down the skill

Ask the user (use `ask` when it is available) until you can state all three:

1. The task the skill covers, with two or three real example requests.
2. What a good result looks like, and the mistakes it must prevent.
3. What the skill needs on the machine: programs, files, accounts.

Skip questions the conversation already answers. Do not write a skill for something you would do correctly without one; say so instead.

## Step 2: Choose the name and folder

- The name is 1-64 characters: lowercase letters, digits and single hyphens, with no leading, trailing or doubled hyphen. Examples: `invoice-check`, `release-notes`.
- The folder name must equal the name exactly.
- The folder is `~/.kucedr/skills/<name>/` (`~` is the user's home directory).

Check for a clash first:

```bash
ls ~/.kucedr/skills 2>/dev/null
```

If the folder already exists, read its `SKILL.md` and ask whether to update it. Never overwrite it silently.

## Step 3: Plan the package

```
<name>/
  SKILL.md        required: frontmatter and instructions
  references/     optional: detail read only when needed
  scripts/        optional: programs the instructions run
  assets/         optional: templates and files copied into results
```

- Keep `SKILL.md` as the workflow. Move long tables, schemas and rarely needed variants into `references/` files, and say in `SKILL.md` exactly when to read each one.
- Add a script only for work that is fragile or tedious to redo by hand each time. Prefer plain instructions.
- Do not add a README, changelog or licence file; `SKILL.md` is the only documentation.

## Step 4: Write SKILL.md

Create it with `write`. Start from this template:

```markdown
---
name: <name>
description: <what it does>. Use when <the situations that call for it>.
license: MIT
---

# <Title>

<One or two sentences: what this produces and for whom.>

## Workflow

1. <First action, with the exact command or tool.>
2. <Next action.>

## Rules

- <A constraint, and the reason for it.>

## Reference files

- `references/<file>.md`: read when <condition>.
```

Frontmatter rules, enforced by the app:

| Key | Rule |
|---|---|
| `name` | Required. Must match the folder name and the pattern in step 2. |
| `description` | Required, at most 1024 characters. Say what the skill does and when to use it; this is all the user and the agent see before loading. |
| `license` | Optional string. |
| `compatibility` | Optional, 1-500 characters. State hard requirements, for example `Needs python3 and ffmpeg on PATH`. |
| `metadata` | Optional map of keys to string, number or boolean values. |
| `allowed-tools` | Optional space-separated string. Display-only; omit it. |

Any other key is ignored with a warning. A missing or invalid required key hides the skill. If the description contains `: ` or starts with a quote or bracket, wrap the whole value in double quotes so the YAML still parses.

Body rules:

- Write to the agent that will follow the skill, in the imperative: "Read the file", "Ask the user".
- Give exact commands, paths and templates. Replace "handle errors properly" with the specific check and what to do when it fails.
- Refer to tools by id: `bash`, `read`, `write`, `edit`, `ask`, `subagent`, `search_web`, `fetch_web_page`, `run_script` and so on.
- Refer to bundled files by path relative to the skill folder (`references/forms.md`, `scripts/convert.py`). The reader is given the folder's absolute path when the skill loads and resolves paths against it.
- Never assume a program is installed. Have the skill test with `command -v <program>` and, when it is missing, tell the user what to install instead of installing it.
- State what must never happen (deleting source files, sending data to a service) as explicit rules.
- Leave out general knowledge the reader already has. Keep what is specific to this task, this user and this machine.

## Step 5: Stay inside the limits

| Item | Limit |
|---|---|
| `SKILL.md` size | 256 KB hard limit. Over 500 lines or about 5,000 tokens gives a warning. Aim for under 200 lines. |
| Context share | A skill estimated above a quarter of the model's context window is refused at load time. |
| Resource files listed to the reader | The first 100; later ones are omitted from the list. |
| One resource file | 10 MB |
| Whole folder | 1,000 files, 50 MB, 12 folder levels |

The last two rows are checked when a folder is imported through Settings; keep to them anyway. Do not put symbolic links in the folder: a link that leaves the folder or points at a directory is skipped.

## Step 6: Verify

1. Read `SKILL.md` back with `read`. Confirm the frontmatter opens and closes with `---`, and that `name` equals the folder name character for character.
2. Check the measurable limits:

```bash
cd ~/.kucedr/skills/<name> && wc -l -c SKILL.md && find . -type l
```

`find` must print nothing.

3. For each script, run it once on a small real input and confirm the output. If its interpreter is missing, report that rather than claiming the script works.
4. Walk through the body as if you knew nothing else. Every step must name its tool or command, and every file it mentions must exist in the folder.

## Step 7: Hand over

Tell the user:

- the folder path;
- that the skill appears in Settings → Skills. A folder with an invalid `SKILL.md` is listed there with its error;
- how to run it: `/skill <name> <their request>`;
- what it needs installed, if anything.

Changes to a skill take effect the next time it is loaded. If the user edits the file while a reply is being generated, ask them to send the command again.

## Fixing an existing skill

| Symptom | Cause | Fix |
|---|---|---|
| Missing from Settings → Skills, or shown with an error | `SKILL.md` absent, unparseable frontmatter, bad `name` or `description` | Check the folder against steps 2 and 4. |
| "must match the parent directory name" | `name` differs from the folder name | Rename one of them. |
| The user's edits have no effect | A user skill with the same name shadows the plugin skill, or the reverse | List `~/.kucedr/skills` and edit the copy that wins: the user folder. |
| Refused when loading | Body larger than a quarter of the context window | Move detail into `references/`. |
| The reader ignores part of the skill | Body too long or instructions vague | Shorten it; turn prose into numbered steps. |
| A subagent does the task wrong | Subagents do not receive skill text | Add a rule to pass the instructions in the subagent prompt. |
| "This skill comes from the ... plugin" on delete | Plugin skills are read-only | Copy the folder to `~/.kucedr/skills` and edit the copy. |
