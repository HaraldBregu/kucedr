# Skill contributions (`skills/`)

Each `skills/<skill-id>/` folder is an agent skill in the standard format: a `SKILL.md` with frontmatter (name, description, optional allowed tools) plus any reference files and scripts it uses. Plugin skills follow the same rules as user skills in `~/.kucedr/skills`.

## Loading

`createSkillRegistrySnapshot()` (`src/main/agent/skills/skills_registry.ts`) reads skills from, in order:

1. the project skills root (if any) — scope `project`
2. `~/.kucedr/skills` — scope `user`
3. `<plugin>/skills` for each enabled plugin — scope `plugin`

Each folder goes through `validateSkill()`; invalid skills become `error` diagnostics. Names are compared case-insensitively, and a later skill with the same name is shadowed by an earlier one with a `duplicate-name` warning. So user and project skills override plugin skills.

`list()` (`skills_list.ts`) is the Settings → Skills listing. It goes user root then plugins, dedupes by folder id, and tags plugin skills with `plugin`.

`resolveSkillFolder(id)` (`skills_resolve_folder.ts`) looks in `~/.kucedr/skills/<id>` first, then in each plugin's `skills/<id>`.

## Read-only

`deleteSkill(id)` (`skills_delete.ts`) refuses plugin skills: `This skill comes from the <plugin> plugin. Disable or remove the plugin instead.` To edit a plugin skill, copy it into `~/.kucedr/skills`; the copy shadows the plugin version.

## Bundled skills

`bootstrap` ships `docx`, `pdf`, `pptx`, and `xlsx` (Office/PDF document skills with Python helpers and OOXML schemas).
