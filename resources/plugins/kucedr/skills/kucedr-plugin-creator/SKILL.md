---
name: kucedr-plugin-creator
description: Create, validate, and package Kucedr desktop plugins that add model providers, remote services, apps, extensions, MCP servers, or skills. Use when the user wants a new Kucedr plugin, wants to bundle existing pieces into one, or needs a plugin manifest fixed; not for changing Kucedr itself.
---

# Kucedr Plugin Creator

A Kucedr plugin is one folder. Its `manifest.json` describes the plugin, and each contribution
lives in its own subfolder with its own file. Kucedr never runs plugin code in its main process:
apps and extensions run sandboxed, and MCP servers run as separate processes.

## Before you start

Ask what the plugin should add, if the request doesn't say. Then pick only the parts it needs:

| Need | Put it in |
| --- | --- |
| Models, vector database, web search, storage, remote MCP services, bots | provider fields in `manifest.json` |
| A full sandboxed HTML app with its own window | `apps/<app-id>/` |
| A small HTML view shown in Kucedr's home page | `extensions/<extension-id>/` |
| Tools for the agent from a local process or a remote server | `mcp/` |
| Instructions the agent loads on demand | `skills/<skill-id>/SKILL.md` |

Build the plugin outside the Kucedr repository unless the user asks for a built-in one under
`resources/plugins/`.

## Layout

```text
<plugin-id>/
  manifest.json
  assets/                      images and other data (plugin and provider icons)
  apps/<app-id>/               manifest.json, index.html, js, css
  extensions/<extension-id>/   manifest.json, index.html, js, css, optional icon
  mcp/servers.json             optional: servers keyed by id (stdio or http)
  mcp/<server-id>/             mcp.json and the server's files (stdio only)
  skills/<skill-id>/           SKILL.md and any files it references
```

Leave out folders the plugin doesn't use. Never add a `providers/` folder: provider fields go in
the plugin manifest.

## Plugin manifest

```json
{
	"schemaVersion": 5,
	"id": "acme-tools",
	"title": "Acme Tools",
	"version": "1.0.0",
	"description": "One sentence on what the plugin adds.",
	"author": "Acme",
	"minAppVersion": "1.2.0",
	"icon": "acme-light.svg",
	"iconDark": "acme-dark.svg"
}
```

- Required: `schemaVersion` (always `5`), `id`, `title`, `version` (semver), and `description`.
- Optional: `author`, `minAppVersion` (blocks older Kucedr versions), `icon`, and `iconDark`.
- `id` uses lowercase kebab-case and must match the folder name.
- `icon` and `iconDark` are file names in `assets/`: png, svg, jpg, or webp, 256 KB at most.
  `iconDark` is shown in dark mode, so make it light-coloured when `icon` is dark.
- Unknown keys are rejected. Leave out keys with nothing in them instead of writing `[]` or `""`.
- The plugin must contain at least one contribution.

## Building each part

Read the guide for each part the plugin needs before writing it. Each guide gives the steps, the
exact file format, a complete working example, and a checklist.

| Part | Guide | In short |
| --- | --- | --- |
| Provider (models and services) | [references/providers.md](references/providers.md) | Provider fields go in the plugin `manifest.json`, and the icons go in `assets/`. The provider id is the plugin `id`. |
| App | [references/apps.md](references/apps.md) | `apps/<id>/manifest.json` plus an `.html` entry. It opens in its own sandboxed window. |
| Extension | [references/extensions.md](references/extensions.md) | `extensions/<id>/manifest.json` plus `index.html`. It's shown in place of the chat, sandboxed, with no network access or inline scripts. |
| MCP server | [references/mcp.md](references/mcp.md) | `mcp/<id>/mcp.json` with a bundled stdio server, or entries in `mcp/servers.json`. Servers start off. |
| Skill | [references/skills.md](references/skills.md) | `skills/<name>/SKILL.md`. Its frontmatter `name` matches the folder, and the `description` says when to use it. |

Work in this order: plugin manifest and icons, then each part, then validation and packaging.

## Validate before handing it over

Check each item, and fix what fails:

1. `manifest.json` parses, has the required fields, uses `schemaVersion` 5, and its `id` matches
   the folder name.
2. Every icon named in a manifest exists, is png/svg/jpg/webp, and is 256 KB or smaller.
3. Each folder under `apps/`, `extensions/`, `mcp/`, and `skills/` is a contribution with its own
   valid file: app `manifest.json` plus entry, extension `manifest.json` plus `index.html`,
   `mcp.json`, or `SKILL.md`. No other files sit directly in those folders, except
   `mcp/servers.json`.
4. No symlinks: `find <plugin-id> -type l` prints nothing.
5. No empty values (`[]`, `{}`, `""`) in `manifest.json`.
6. Stdio MCP servers start with `node <entry>` from their own folder without network installs.

In a Kucedr checkout, you can also check the plugin manifest against
`src/shared/plugin_manifest.ts` and the provider fields against
`src/shared/providers/validation.ts`.

## Install and package

- **Try it locally:** copy the folder to `~/.kucedr/plugins/<plugin-id>/`. Kucedr picks up the
  change and lists the plugin in Settings → Plugins → Downloaded.
- **Share it:** pack the folder as a `.tgz` archive with `manifest.json` at its root or inside one
  top-level folder (npm tarballs work):

  ```sh
  tar czf acme-tools-1.0.0.tgz -C <parent-dir> acme-tools
  ```

  Archives can be installed from a file or downloaded over https (200 MB at most). Installing a
  plugin with an existing id replaces it.
- Tell the user where the plugin is and which parts it adds. Explain that its MCP servers start off,
  and that providers need an API key in Settings → Providers when they use one.
