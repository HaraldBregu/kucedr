# Creating a skill

A skill is a folder of instructions that the agent loads only when a task needs it. It's the
cheapest way to teach Kucedr a workflow, a format, or house rules: plain Markdown, plus optional
scripts and reference files.

## Steps

1. **Define the trigger.** Write down what the skill does and when the agent should use it, in
   one or two sentences. This becomes the `description`, which is all the agent sees when deciding
   whether to load the skill.
2. **Pick the name:** lowercase kebab-case, at most 64 characters. Create `skills/<name>/`. The
   folder name and the `name` field must be identical.
3. **Write `SKILL.md`:** frontmatter, then the instructions.
4. **Move long material out of `SKILL.md`.** Put reference docs, templates, and examples in files
   next to it, and link to them by relative path so the agent reads them only when needed.
5. **Add scripts** to the folder for repeatable steps that code does better than prose. Tell the
   agent when to run them and with what arguments.
6. **Test:** install the plugin, check the skill in Settings → Skills, then give the agent a task
   that should trigger it.

## SKILL.md

```markdown
---
name: release-notes
description: Write release notes from a list of merged changes. Use when the user asks for release notes, a changelog entry, or a summary of what shipped.
license: MIT
---

# Release notes

1. Group the changes into Added, Changed, Fixed, and Removed.
2. Write one line per change, starting with a verb, in the user's language.
3. Leave out internal refactors unless the user asks for them.

See [style.md](style.md) for tone and examples.
```

Frontmatter fields:

| Field | Rule |
| --- | --- |
| `name` | required; lowercase kebab-case; same as the folder name |
| `description` | required; at most 1024 characters; say what it does *and* when to use it |
| `license` | optional string |
| `compatibility` | optional; at most 500 characters (for example, required tools or OS) |
| `metadata` | optional map of string keys to string values |
| `allowed-tools` | optional; tools the skill expects to use |

`SKILL.md` can be at most 256 KB.

## Layout

```text
skills/<name>/
  SKILL.md
  style.md            reference material, loaded on demand
  templates/          files the agent copies or fills in
  scripts/            helpers the agent runs
```

## Writing good instructions

- Write for the agent: say what to do, in order, and what done looks like.
- Keep `SKILL.md` short, and put rarely needed detail in linked files.
- Give exact commands, file names, and formats rather than general advice.
- Say what not to do when there's a common mistake.

## Checklist

- `name` matches the folder and uses lowercase kebab-case.
- `description` says what the skill does and when to use it.
- Every linked file exists inside the skill folder. No links point outside it, and there are no
  symlinks.
- Scripts run with only what the plugin bundles.
