# Plan: the `kucedr-plugins` repository

This plan is for an AI agent working in a new, empty repository, `Kucedr/kucedr-plugins`.
Everything it needs is in this file. The Kucedr desktop app isn't in that repository, so don't
import from it.

## Goal

A public repository that:

1. holds Kucedr plugins, one folder per plugin;
2. lets anyone add or update a plugin through a pull request;
3. checks every pull request against the plugin rules below;
4. on merge to `main`, packs each changed plugin into a `.tgz`, attaches it to a GitHub Release,
   and publishes a catalog, `index.json`, to GitHub Pages.

The Kucedr app reads `index.json` at runtime and downloads plugins from it into
`~/.kucedr/plugins/<id>/`. That part lives in the app repository and isn't in this plan.

## Layout

```text
kucedr-plugins/
  plugins/<plugin-id>/          one plugin (format below)
  scripts/validate.mjs          checks every plugin; exits 1 on the first problem in each plugin
  scripts/catalog.mjs           builds dist/index.json and dist/icons/
  .github/workflows/validate.yml
  .github/workflows/release.yml
  .github/CODEOWNERS
  .github/pull_request_template.md
  CONTRIBUTING.md
  README.md
  package.json                  "type": "module", devDependencies: zod, gray-matter
```

Scripts are plain Node 22 ESM with no build step. The only dependencies are `zod` and `gray-matter`.

## Plugin format

```text
<plugin-id>/
  manifest.json               plugin info, plus provider services when it is a provider
  assets/                     images (the icons named in manifest.json live here)
  apps/<app-id>/              manifest.json + index.html, js, css
  mcp/servers.json            optional: server configs keyed by id (stdio or http)
  mcp/<server-id>/            mcp.json (+ server files, stdio only)
  skills/<skill-id>/          SKILL.md
```

`manifest.json`, schema version 5:

```json
{
	"schemaVersion": 5,
	"id": "acme-tools",
	"title": "Acme Tools",
	"version": "1.0.0",
	"description": "What the plugin adds.",
	"categories": ["LLM", "TTS"],
	"author": "Acme",
	"minAppVersion": "1.2.0",
	"icon": "icon.svg"
}
```

App `apps/<app-id>/manifest.json`:

```json
{
	"title": "Word counter",
	"description": "Counts the words in pasted text.",
	"mode": "extension",
	"metadata": { "version": "1.0.0", "category": "writing", "entry": "index.html" }
}
```

## Validation rules (`scripts/validate.mjs`)

These match the checks the app runs at install, so a plugin that passes here installs cleanly.
Validate every folder in `plugins/`, collect every error as `plugins/<id>: <message>`, print
them all, and exit 1 if there were any.

**Plugin manifest** (zod, `.strict()`, so unknown keys fail):

| Field | Rule |
| --- | --- |
| `schemaVersion` | exactly `5` |
| `id` | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, equal to the folder name, not `kucedr` (reserved) |
| `title`, `description` | non-empty after trim |
| `version` | semver: `^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$` |
| `minAppVersion` | optional, same semver pattern |
| `categories` | optional array of non-empty strings |
| `author` | required, non-empty |
| `icon`, `iconDark` | optional, `^[\w-]+\.(?:png\|svg\|jpe?g\|webp)$`; the file must exist in `assets/` and be 256 KB or smaller |
| Provider fields | optional, any value: `authentication`, `apiKeyUrl`, `icon_dark_url`, `icon_light_url`, `instructions`, `models`, `mcp_servers`, `vector_databases`, `web_search`, `storage`, `bots`, `settings`. The app checks these in depth at install, so only check that they're there. |

**Files:**

- No symlinks anywhere in the plugin (use `lstat`).
- Under `apps/`, `mcp/`, and `skills/`, every entry is a folder, except `mcp/servers.json`.
  Entries starting with `.` are ignored.
- A plugin must contain at least one app, MCP server, skill, or provider field.
- Fail if the plugin contains `node_modules/` or a `package.json` with an `install`,
  `preinstall`, or `postinstall` script. Kucedr never runs `npm install`, so stdio MCP servers
  must be bundled.

**Apps** (`apps/<app-id>/manifest.json`):

- `title` and `description` are non-empty strings.
- `handle`, if present, matches `^@[a-z0-9][a-z0-9._-]*$` (case-insensitive).
- `mode`, if present, is `extension` or `window`.
- `metadata` is an object with non-empty string `version` and `category`.
- `metadata.entry` is a relative path ending in `.html`: no leading `/`, no `\`, and no empty,
  `.`, or `..` segments. The file must exist.

**MCP:**

- `mcp/servers.json`, if present, is a JSON object (not an array).
- An id can't be both a folder `mcp/<id>/` and a key in `servers.json`.
- Every `mcp/<id>/` folder contains a valid JSON `mcp.json`.

**Skills** (`skills/<skill-id>/SKILL.md`, frontmatter parsed with `gray-matter`):

- `SKILL.md` exists and is 256 KB or smaller.
- `name` is required, at most 64 characters, matches `^[a-z0-9]+(?:-[a-z0-9]+)*$`, and equals
  the folder name.
- `description` is required, non-empty, and at most 1024 characters.
- Optional: `license` is a string, `compatibility` is a 1–500 character string, `metadata` maps
  strings to strings, and `allowed-tools` is a non-empty string.

**Version bump** (run only in pull requests, with `--base origin/main`):

- For every plugin with changed files, read `plugins/<id>/manifest.json` from the base with
  `git show origin/main:plugins/<id>/manifest.json`. If it exists, the new `version` must be
  higher (compare major, minor, patch numerically). A new plugin has no base version, so it passes.
- A pull request may not change the `id` of an existing folder or delete another author's plugin.
  A deletion needs a maintainer's approval through `CODEOWNERS`.

## Packaging and catalog

**Package:** `tar -czf dist/<id>-<version>.tgz -C plugins <id>`. The archive holds one wrapper
folder, `<id>/`, which the app's installer already handles. Exclude `.DS_Store` and dotfiles.

**Integrity:** `sha512-` plus the base64 SHA-512 of the `.tgz` (the same format as npm's
`integrity`).

**Release:** one GitHub Release per plugin version, tagged `<id>-v<version>`, with the `.tgz`
attached. If the tag already exists, skip that plugin; never overwrite a release.

**Catalog** (`scripts/catalog.mjs` writes `dist/index.json`), listing every plugin sorted by `id`:

```json
{
	"schemaVersion": 1,
	"generatedAt": "2026-10-25T12:00:00.000Z",
	"plugins": [
		{
			"id": "acme-tools",
			"title": "Acme Tools",
			"description": "What the plugin adds.",
			"author": "Acme",
			"categories": ["LLM"],
			"icon": "https://kucedr.github.io/kucedr-plugins/icons/acme-tools.svg",
			"version": "1.0.0",
			"minAppVersion": "1.2.0",
			"url": "https://github.com/Kucedr/kucedr-plugins/releases/download/acme-tools-v1.0.0/acme-tools-1.0.0.tgz",
			"integrity": "sha512-…",
			"contains": ["apps", "skills"]
		}
	]
}
```

- `icon` is left out when the manifest has none. The script copies the icon to
  `dist/icons/<id>.<ext>`.
- `contains` lists the kinds that are present, in the order `apps`, `mcp`, `providers`, `skills`.
- The `integrity` is the one of the released `.tgz`. For plugins that weren't changed in this run,
  download the existing release asset with `gh release download` and hash it, so the `.tgz` isn't
  rebuilt with a different hash.

## Workflows

**`.github/workflows/validate.yml`** runs on `pull_request` to `main`:

1. `actions/checkout@v4` with `fetch-depth: 0`.
2. `actions/setup-node@v4` with Node 22, then `npm ci`.
3. `node scripts/validate.mjs --base origin/main`.

**`.github/workflows/release.yml`** runs on `push` to `main` and on `workflow_dispatch`. It has
`permissions: contents: write, pages: write, id-token: write` and
`concurrency: { group: release, cancel-in-progress: false }`.

1. Checkout, set up Node, run `npm ci`, then `node scripts/validate.mjs` (no `--base`).
2. For each plugin, if the release `<id>-v<version>` doesn't exist (`gh release view`), pack it and
   `gh release create <id>-v<version> dist/<id>-<version>.tgz --title "<title> <version>" --notes "<description>"`.
   Use `GH_TOKEN: ${{ github.token }}`.
3. `node scripts/catalog.mjs`.
4. `actions/upload-pages-artifact@v3` with `path: dist`, then `actions/deploy-pages@v4`. Only
   `index.json` and `icons/` need to be in the artifact, so leave out the `.tgz` files.

In the repository settings, set Pages → Source to "GitHub Actions". The catalog URL is then
`https://kucedr.github.io/kucedr-plugins/index.json`.

## Contribution rules

**`.github/CODEOWNERS`:**

```text
*                       @HaraldBregu
/plugins/<plugin-id>/   @<author-github-login>
```

Add a line for each plugin's author when their plugin is first merged, so later changes to that
folder need their review. In repository settings, protect `main`: require a pull request,
require the `validate` check, and require review from code owners.

**`CONTRIBUTING.md`** covers:

1. Fork, then add `plugins/<your-plugin-id>/` in the format above.
2. Run `npm ci && node scripts/validate.mjs` locally.
3. To test in Kucedr, open Settings → Plugins and drop the folder on the upload tile.
4. For updates, change the files and raise `version`.
5. What gets rejected: obfuscated code, network calls the description doesn't mention, bundled
   secrets or API keys, and copyrighted assets without a license.

**`.github/pull_request_template.md`:** checkboxes for "validate passes locally", "version raised",
"tested in Kucedr", and "no secrets or keys in the files".

## Seed content

Add one small example plugin, `plugins/hello-skill/`, with only a skill
(`skills/hello-skill/SKILL.md`) and an icon, so the first release and catalog run end to end.

## Done when

1. `node scripts/validate.mjs` passes on `hello-skill` and fails with a clear message for each of
   these temporary changes: folder name ≠ `id`, an unknown manifest key, a missing icon file, a
   symlink, a skill whose `name` doesn't match its folder, and an app whose entry file doesn't exist.
2. A pull request that changes `hello-skill` without raising `version` fails the `validate` check.
3. After merging to `main`, the release `hello-skill-v1.0.0` exists with its `.tgz`, and
   `https://kucedr.github.io/kucedr-plugins/index.json` lists it with a matching `integrity`
   (check with `shasum -a 512 -b` and base64).
4. Running the release workflow again creates no new release and leaves `integrity` unchanged.
5. In Kucedr, Settings → Plugins → Install from URL with the `.tgz` URL installs `hello-skill`.
