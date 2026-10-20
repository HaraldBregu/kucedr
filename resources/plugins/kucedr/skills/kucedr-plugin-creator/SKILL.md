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
- Unknown keys are rejected, and so are empty values: drop a key instead of writing `[]` or `""`.
- The plugin must contain at least one contribution.

## Provider fields

A plugin becomes a provider when its manifest has provider fields. The provider id is the plugin
`id`, and its name is the plugin `title`.

```json
{
	"schemaVersion": 5,
	"id": "acme",
	"title": "Acme",
	"version": "1.0.0",
	"description": "Acme chat models.",
	"icon": "acme-light.svg",
	"iconDark": "acme-dark.svg",
	"authentication": "api-key",
	"apiKeyUrl": "https://acme.test/keys",
	"icon_dark_url": "/assets/acme-dark.svg",
	"icon_light_url": "/assets/acme-light.svg",
	"models": [
		{
			"id": "acme-chat-1",
			"name": "Acme Chat 1",
			"type": "large-language-model",
			"authentication": "api-key",
			"url": "https://api.acme.test/v1",
			"location": "remote",
			"metadata": {
				"documentationUrl": "https://docs.acme.test/models",
				"contextWindow": 128000,
				"inputs": { "temperature": { "type": "number" }, "max_tokens": { "type": "integer" } }
			}
		}
	]
}
```

- `authentication` is `api-key`, `oauth2`, or `none`. Add `apiKeyUrl` for api-key providers.
- Icon paths start with `/assets/` and point to files in `assets/`.
- Model `type` is one of `large-language-model`, `research-chat-model`, `speech-to-text-model`,
  `text-to-speech-model`, `realtime-voice-model`, `text-to-image-model`, `text-to-video-model`,
  `text-to-audio-model`, or `embedding-model`. `location` is `remote` or `local`.
- Services in other fields use the same `id`, `name`, `url`, `authentication`, and `metadata`
  shape: `vector_databases`, `web_search`, `mcp_servers` (remote MCP services the user can add),
  `bots`, and `storage` (one object, not a list).
- An unknown provider id is sent to an OpenAI-compatible chat API, so a JSON-only plugin works for
  any OpenAI-compatible service.
- Copy the closest built-in provider as a starting point: in a Kucedr checkout, see
  `resources/plugins/<provider>/manifest.json` (for example `deepseek`, `brave`, or `pinecone`).
  The full rules are in `src/shared/providers/validation.ts`.
- Document only parameters that the provider's own documentation confirms.

## Apps

`apps/<app-id>/manifest.json`:

```json
{
	"title": "Acme Dashboard",
	"description": "Account usage and status.",
	"metadata": { "version": "1.0.0", "category": "productivity", "entry": "index.html" }
}
```

`title`, `description`, `metadata.version`, `metadata.category`, and `metadata.entry` are
required, and the entry file must exist. For apps that use the `@kucedr/sdk` bridge, follow the
`kucedr-app-creator` skill and ship only the built output.

## Extensions

`extensions/<extension-id>/manifest.json`:

```json
{
	"title": "Word counter",
	"description": "Counts the words in pasted text.",
	"slot": "panel",
	"icon": "icon.svg"
}
```

- `slot` is `sidebar`, `panel`, `toolbar`, `composer`, or `settings`. Today every extension is
  listed in the home sidebar and opens in place of the chat.
- `index.html` is required. It loads in a sandboxed iframe with no network access: bundle every
  script, style, image, and font in the extension folder and reference them with relative paths.
  Inline styles work; inline scripts don't.
- The optional `icon` is a file in the extension folder (same rules as the plugin icon).

## MCP servers

- **Local stdio server:** `mcp/<server-id>/mcp.json` next to the server's files.

  ```json
  {
  	"id": "acme-files",
  	"name": "Acme Files",
  	"type": "stdio",
  	"command": "node",
  	"args": ["server.mjs"],
  	"cwd": ".",
  	"require_approval": "always"
  }
  ```

- **Several servers in one file:** `mcp/servers.json` maps ids to the same fields. It also accepts
  remote servers, `{ "type": "http", "url": "https://..." }` (https, or http on localhost).
- An id is either a folder or a `servers.json` key, never both.
- Bundle stdio servers completely: one `.mjs` file, or the server with its `node_modules`.
  Kucedr never runs `npm install`, and plugins can't contain symlinks, so install with
  `npm install --no-bin-links` (or add `bin-links=false` to the server's `.npmrc`).
- Plugin servers start disabled. The user turns them on in Settings → MCP servers.
- OAuth sign-in isn't supported for remote plugin servers.

## Skills

`skills/<skill-id>/SKILL.md` with frontmatter whose `name` matches the folder:

```markdown
---
name: release-notes
description: What the skill does and when the agent should use it.
---

# Release notes

Instructions for the agent.
```

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
