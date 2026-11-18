---
name: plugin-creator
description: Author a Kucedr plugin - a folder with a manifest.json that adds scripts (chat renderers and tool or model-turn hooks), agent modes (slash commands that change how the agent behaves), HTML apps and colour themes to the app. Use when the user wants to build, extend, package or install their own Kucedr plugin, add a mode, script, app or theme, or work out why a plugin shows an error or one of its contributions does not appear.
license: MIT
---

# Plugin creator

A Kucedr plugin is a folder with a `manifest.json` and one or more contribution folders. This file covers the plugin itself and the workflow. Each contribution kind has its own reference file next to this one; read the file for a kind before you write that kind, and only then:

| Kind | Folder | What it adds | Read |
|---|---|---|---|
| Script | `scripts/<name>/` | A renderer the agent calls with `run_script`, or a hook that runs around every tool call or model turn | `scripts.md` |
| Mode | `modes/<id>/` | A slash command that adds a system prompt and limits to a chat run | `modes.md` |
| App | `apps/<id>/` | A local HTML app, inside the main window or in its own window | `apps.md` |
| Theme | `themes/<id>/` | Light and dark colour tokens selectable in Settings | `themes.md` |

A plugin can also carry `skills/<name>/` folders (same format as user skills) and `mcp/` servers. For a standalone skill or MCP server, the user does not need a plugin.

## Step 1: Scope

Ask the user (with `ask` when available) what the plugin should add, then map each wish to a kind from the table. Settle:

- the plugin id: lowercase letters, digits and single hyphens (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). It must not be `kucedr` and must not equal the id of a plugin that ships with the app (for example `bootstrap`, `openai`, `ollama`, `brave`). Check what exists:

```bash
ls ~/.kucedr/plugins 2>/dev/null
```

- a title, a one-sentence description and the author name;
- one id per contribution, in the same lowercase-hyphen form.

Build the smallest plugin that does what was asked. Do not add kinds the user did not request.

## Step 2: Build in the workspace

Create the plugin as a folder named exactly like its id inside the current workspace, not directly in `~/.kucedr/plugins`. The app watches that folder and loads half-written plugins.

```
<id>/
  manifest.json
  assets/            icon files named in the manifest
  scripts/<name>/
  modes/<id>/
  apps/<id>/
  themes/<id>/
```

Rules for the tree:

- Inside a kind folder, every entry must be a folder. Only dotfiles and a top-level `README.md` are tolerated; any other loose file makes the whole plugin fail with `<kind>/<name> must be a folder.`
- At least one contribution must exist, or the plugin is rejected.
- No symbolic links anywhere. This rules out shipping a `node_modules` folder that contains `.bin` links; bundle script code into plain files instead.
- All paths written in contribution manifests are relative, use `/`, and contain no `..`, `.` or empty segments.

## Step 3: Write manifest.json

```json
{
	"schemaVersion": 5,
	"id": "<id>",
	"title": "<Title>",
	"version": "1.0.0",
	"description": "<One sentence.>",
	"author": "<Author>"
}
```

The object is strict: an unknown key fails the plugin.

| Field | Required | Rule |
|---|---|---|
| `schemaVersion` | yes | The number `5`. |
| `id` | yes | Equals the folder name. |
| `title` | yes | Non-empty. Shown as the plugin name. |
| `version` | yes | Semver `1.2.3`, with optional `-pre` or `+build`. |
| `description` | yes | Non-empty. |
| `author` | yes | Non-empty. |
| `categories` | no | Array of non-empty strings. |
| `website` | no | An `https://` URL. |
| `minAppVersion` | no | Semver. The plugin fails to load on an older app. |
| `icon`, `iconDark` | no | A bare file name in `assets/` (letters, digits, `_`, `-`) ending in `png`, `svg`, `jpg`, `jpeg` or `webp`. The file must exist and be at most 256 KB. |
| `settings` | no | `{ "inputSchema": { "type": "object", "properties": { ... }, "required": [...] } }`. Each property needs `type`; `title`, `description` and `format` are optional. `"format": "password"` values are stored encrypted. |

Plugin-level `settings` are a form in Settings → Plugins. Nothing passes them to scripts, modes or apps, so do not declare any for those kinds. A hook script declares its own settings in its script manifest; see `scripts.md`.

## Step 4: Write the contributions

For each kind in scope, `read` its reference file from this skill's folder and follow it. Create every file with `write`.

If a contribution needs a build step or a runtime (Node, a bundler), check first and report what is missing instead of installing it:

```bash
command -v node npm
```

The app never runs `npm install` or a build. Whatever a manifest names as its entry must already exist as a finished file.

## Step 5: Check before installing

Copying a folder into place skips the per-contribution checks that a packaged install runs, and a broken contribution is then dropped without any message. Run the checks yourself:

1. Parse every JSON file. With Node available:

```bash
cd <id> && find . -name '*.json' -not -path '*/node_modules/*' -exec node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" {} \; -print
```

Without Node, `read` each file and check it by eye.

2. Confirm there are no links and no loose files in kind folders:

```bash
cd <id> && find . -type l; find scripts modes apps themes -maxdepth 1 -type f 2>/dev/null
```

Both must print nothing, apart from an optional `README.md`.

3. Confirm every file a manifest points to exists: each script `metadata.entry` and `metadata.instructions`, each mode `SYSTEM_PROMPT.md`, each app `metadata.entry` and `metadata.image`, each plugin icon.
4. Run the kind-specific checks at the end of each reference file.

## Step 6: Install

Installing changes the user's app, so ask before you do it. Then copy the finished folder:

```bash
test -e ~/.kucedr/plugins/<id> && echo exists || { mkdir -p ~/.kucedr/plugins && cp -R <id> ~/.kucedr/plugins/; }
```

If it prints `exists`, the plugin is already installed: tell the user it will be updated, get their agreement, and follow "Updating and removing". Never touch `~/.kucedr/plugins/settings.json`, and never edit other plugins.

The app picks the folder up within moments; no restart is needed. Plugins are enabled by default.

## Step 7: Confirm with the user

You cannot see the Settings window. Ask the user to check:

- Settings → Plugins lists the plugin with no error. An error there is the first failed manifest check; fix it in the workspace copy and copy again.
- Each contribution appears where its reference file says: Settings → Scripts, Settings → Modes, Settings → Apps, or the theme picker in Settings → General.

If the plugin is listed without an error but a contribution is missing, that contribution's own manifest is invalid: re-run step 5 for it.

## Updating and removing

- To update: edit the workspace copy, raise `version`, and copy its contents over the installed folder with `cp -R <id>/. ~/.kucedr/plugins/<id>/`. This does not delete files you removed from the plugin; name those to the user and delete them one by one after they agree.
- To remove: the user removes it in Settings → Plugins, or disables it there to keep the files.
- When two plugins offer the same script name, mode id, mode command or app id, the one that loads first wins and the other is skipped silently. Choose specific ids.

## Common plugin errors

| Message | Fix |
|---|---|
| `Missing manifest.json.` / `manifest.json is not valid JSON.` | Create or repair the file at the plugin root. |
| `<field>: ...` after the plugin name | That manifest field breaks a rule in step 3. An unknown key reports as an unrecognised key. |
| `The folder name must match the plugin id "<id>".` | Rename the folder. |
| `Requires Kucedr <version> or newer.` | Lower or drop `minAppVersion`. |
| `Plugins cannot contain links: <path>` | Remove the link; replace it with a real file. |
| `<kind>/<name> must be a folder.` | Move or delete the loose file. |
| `A plugin must contain at least one contribution.` | Add a contribution folder. |
