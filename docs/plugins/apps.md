# App contributions (`apps/`)

Each `apps/<app-id>/` folder is one HTML app. The folder name is the app id.

## Manifest

`apps/<id>/manifest.json`, validated by `isAppManifest()` (`src/main/apps/app_manifest_validate.ts`):

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Non-empty. |
| `description` | yes | Non-empty. |
| `handle` | no | `@name` (letters, digits, `.`, `_`, `-`). |
| `author` | no | Non-empty string. |
| `mode` | no | One of `APP_MODES` (`src/shared/installed_app_types.ts`), e.g. `window` (own window) or `extension`. |
| `metadata.version` | yes | Non-empty. |
| `metadata.category` | yes | Non-empty, e.g. `games`, `productivity`. |
| `metadata.entry` | yes | Relative path to the HTML entry. |
| `metadata.image` | no | Relative path to the app icon. |
| `metadata.author` | no | |
| `window` | no | Window options checked by `isAppWindowSettings()`: `width`, `height`, `minWidth`, `minHeight`, `resizable`, `maximizable`, `frame`, `transparent`, `alwaysOnTop`, `type`, `titleBarStyle`. |

Instead of `manifest.json`, an app folder can have a `package.json`. `name`, `description`, `version`, the first `keywords` entry (category, default `utility`), `main` or `exports` (entry), and `kucedr.window` / `kucedr.mode` are mapped to the same shape.

Example (`bootstrap/apps/taxes/manifest.json`):

```json
{
	"title": "Taxes",
	"description": "…",
	"mode": "window",
	"metadata": { "version": "1.0.0", "category": "productivity", "entry": "index.html", "image": "icon.svg" },
	"window": { "width": 700, "height": 630, "resizable": true, "titleBarStyle": "hidden" }
}
```

## Loading

`listApps()` (`src/main/apps/app_list.ts`) merges three sources. The first one to use an id wins:

1. user-installed apps in `~/.kucedr/apps/<id>`
2. debug apps (`debugAppPaths()`)
3. plugin apps from `pluginDirs('apps')`, tagged with `plugin`

An app is skipped if its manifest is invalid or its entry file is missing. Icons are served as `kucedr-app://<id>/<image>`.

`appDirectory(id)` (`src/main/apps/app_directory.ts`) resolves an app's files. It falls back to `pluginAppDirectory(id)` when no installed copy exists, so the `kucedr-app://` protocol (`src/main/protocol.ts`) serves plugin apps straight from the plugin folder.

At install, `validatePluginContents()` requires every `apps/<id>` to have a valid manifest and an existing entry file. At runtime, broken apps are skipped without an error.
