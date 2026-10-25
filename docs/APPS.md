# Apps

Kucedr runs installable local HTML applications inside the main window (extension mode) or in dedicated desktop windows, as each app's manifest allows. Manage them in **Settings → Apps**. This repository does not contain bundled app source folders. Apps are installed by plugins from the marketplace in **Settings → Plugins**; during development, register a built app folder as a debug app.

The Workspace file browser is part of the main Kucedr window. Open it at `/workspace` or from **Settings → Workspace**; it is not installed through Settings → Apps. The Coding entry is marked **Soon**, and its old route redirects to Workspace.

## Install, open, and remove an app

1. Install a plugin that contains the app from **Settings → Plugins → Marketplace**. Its apps appear in **Settings → Apps**.
2. Use **Open** on the app card to open it in its default mode. Click the card for **Details**: app information, mode, and window settings for `window` apps.
3. Use the card's delete action to remove an installed app. Confirming deletion permanently removes its installed folder and app-scoped stored data.

An app's folder name is its ID and must begin with an alphanumeric character, followed only by alphanumeric characters, underscores, or hyphens. Each card shows the app's version and author; the author comes from the app manifest's optional `author`, or from the plugin that provides the app.

**Open folder** opens the managed apps directory; **Refresh** reloads the inventory. Opening an already open app focuses its existing window.

Sources: [Settings Apps](../src/renderer/src/pages/settings/pages/apps/Page.tsx), [IPC actions and delete confirmation](../src/main/ipc/apps.ts), [window lifecycle](../src/main/apps/app_render.ts).

## Opening modes

The optional top-level `mode` in an app's `manifest.json` (or `kucedr.mode` in `package.json`) decides where it opens:

| `mode` | Opens | Window settings |
| --- | --- | --- |
| `extension` (default) | Inside the main window, in place of the chat on the home page | Not used |
| `window` | Its own desktop window | `window` section |

```json
{
	"title": "Tetris",
	"description": "Stack falling tetrominoes.",
	"mode": "extension",
	"metadata": { "version": "1.0.0", "category": "games", "entry": "index.html", "image": "icon.svg" },
	"window": { "width": 420, "height": 560 }
}
```

`metadata.image` (png, jpg, webp, avif, or svg inside the app folder) is the app's icon in Settings → Apps, the command menu, and the home sidebar.

`apps:open` refuses an `extension`-only app. Apps without `mode` open inside Kucedr.

**Extension mode.** The home page shows the app in an iframe with `sandbox="allow-scripts"`, loaded from `kucedr-app://<id>/<entry>`, with a header holding its title and a close button; the open app is also listed in the home sidebar under New chat. The frame has no preload and no `window.app` SDK. Main-window responses carry the CSP `default-src 'none'; script-src kucedr-app:; style-src kucedr-app: 'unsafe-inline'; img-src kucedr-app: data:; font-src kucedr-app: data:; media-src kucedr-app: data:`, so there is no network access and no inline script. App windows (separate session) are unaffected.

**Shared storage.** Both modes use the same `~/.kucedr/apps/<id>/data/store.json`. In a window, use `window.app.getAppStoreValue` / `setAppStoreValue`. In extension mode, post `{ kucedrStore: <request id>, op: 'get' | 'set' | 'delete', key, value }` to `window.parent`; the host answers with `{ kucedrStore, value }` (or `error`). The bundled Triangle app's `store.js` shows a shim that picks the right path. App files (`readAppStoreFile`, …) are window-only.

Sources: [mode type](../src/shared/installed_app_types.ts), [manifest validation](../src/main/apps/app_manifest_validate.ts), [open hook](../src/renderer/src/hooks/app.ts), [in-app host](../src/renderer/src/pages/home/components/ExtensionPage.tsx), [store IPC](../src/main/ipc/apps.ts), [CSP](../src/main/protocol.ts).

## Debug an external app folder

In the debug section of **Settings → Apps**, select a folder using the native picker, then add it. Kucedr registers the original folder and runs its entry directly without copying its application files into managed storage. Build the entry first; registering source code does not start a development server.

The selected folder needs a valid manifest and an existing entry file contained within that folder. Folder IDs cannot collide with an installed app or another registered debug folder. A symlink used as the selected folder is rejected, and an entry resolving outside the folder is rejected.

Debug apps have a badge and their registered paths appear in Settings. Removing one unregisters it and closes its window without deleting the source folder. App-scoped SDK data still lives under `~/.kucedr/apps/<id>/data`, rather than the external source folder; unregistering the debug app does not remove that data. Window-setting changes write to the app's manifest, including the external manifest for a debug app.

Sources: [debug registration](../src/main/apps/app_debug_add.ts), [debug removal](../src/main/apps/app_debug_remove.ts), [directory resolution](../src/main/apps/app_directory.ts), [window settings persistence](../src/main/apps/app_write.ts).

## Apps from plugins

A plugin can ship apps in its `apps/<app-id>/` folder. They are listed in Settings → Apps after installed and debug apps, tagged with their plugin, and open by the same `mode` rules. Their files stay inside the plugin folder; their app-scoped data still goes to `~/.kucedr/apps/<id>/data`. An installed or debug app with the same ID wins. A plugin app can't be deleted on its own: disable or remove its plugin in Settings → Plugins. See [Plugins](PLUGINS.md).

Sources: [plugin app lookup](../src/main/apps/app_plugin_directory.ts), [app list](../src/main/apps/app_list.ts), [delete guard](../src/main/apps/app_delete.ts).

## Workspace

Workspace shows agent workspace files in a tree beside a resizable viewer. Its context menu creates files and folders, renames entries, and confirms deletion. Markdown opens in editable Text and Raw views and saves changes automatically; other text and code open read-only. Images, audio, video, and PDFs open in their respective viewers. The viewer can find text in supported files; unsupported files show a preview-unavailable message. Workspace changes from the host refresh the file list.

Sources: [Workspace page](../src/renderer/src/pages/workspace/Page.tsx), [file actions](../src/renderer/src/pages/workspace/Sidebar.tsx), [file tree](../src/renderer/src/pages/workspace/Tree.tsx), [viewer](../src/renderer/src/pages/workspace/Viewer.tsx).

## Storage and window reference

| Location                              | Contents                            |
| ------------------------------------- | ----------------------------------- |
| `~/.kucedr/apps/<id>/`                | Installed app files                 |
| `~/.kucedr/apps/<id>/data/store.json` | App-scoped key/value data           |
| `~/.kucedr/apps/<id>/data/files/`     | App-scoped files                    |
| `~/.kucedr/settings/apps-debug.json`  | Registered external app paths       |
| External debug folder                 | Debug app source/build and manifest |

The data root can be overridden by `KUCEDR_E2E_DATA_ROOT` for tests. App-scoped file and value APIs validate IDs and reject invalid storage paths or symlink storage directories.

**Details → Window** (shown for `window` apps) controls width, height, minimum dimensions, resizability, maximization, system frame, transparency, always-on-top, window type (`normal`, `panel` on macOS, `toolbar` on Windows and Linux), and the macOS title bar style. Changes apply on the next opening of the app window. Host defaults are 820×640 with a 620×480 minimum, resizable and maximizable, frameless, transparent, not always on top, a normal window type, and a hidden title bar. Selecting default values removes the custom window section from the manifest.

Sources: [data root](../src/main/shared/user_data_location.ts), [value storage](../src/main/apps/app_values.ts), [file storage](../src/main/apps/app_files.ts), [debug registry](../src/main/apps/app_debug_store.ts), [window settings UI](../src/renderer/src/pages/settings/pages/apps/details/Window.tsx), [window defaults](../src/shared/app_window_settings.ts).

## Troubleshooting

- **App not listed:** ensure its folder name is a valid ID, its manifest validates, and its built entry exists; then refresh Settings Apps.
- **Missing entry:** build the app before importing or registering it. Import excludes `node_modules`, so runtime dependencies must be included in the generated frontend bundle.
- **Source edits do not appear:** an installed app runs its copied files. Rebuild and reimport it, or register an external debug folder after resolving any ID collision.
- **Debug ID already in use:** use a distinct valid folder name or remove the conflicting registration/install after preserving any data you need.
- **Model action fails:** inspect the relevant host provider/model configuration and the reported error. A browser preview has no host SDK runtime.
- **Window settings seem unchanged:** close the existing window and reopen it; opening an already open app only focuses that window.

For repository setup and checks, see [Development](DEVELOPMENT.md). For broader product capabilities, see [Features](FEATURES.md).
