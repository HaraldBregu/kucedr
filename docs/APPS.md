# Apps

Kucedr opens installable local HTML applications in dedicated desktop windows. Manage them in **Settings → Apps**. This repository does not contain bundled app source folders. Build an app in a separate project, then import its built folder or register it as a debug app.

The Workspace file browser is part of the main Kucedr window. Open it at `/workspace` or from **Settings → Workspace**; it is not installed through Settings → Apps. The Coding entry is marked **Soon**, and its old route redirects to Workspace.

## Install, open, and remove an app

1. Obtain an app folder containing a valid `manifest.json` or supported `package.json`, plus its built entry file.
2. In **Settings → Apps**, open the page action menu and choose the upload action. The native folder picker accepts multiple folders.
3. Check the reported import result. Invalid folders are skipped with a reason.
4. Use **Open** on the app card. Use **Details** for app information and window settings; the card itself does not navigate.
5. Use the card's delete action to remove an installed app. Confirming deletion permanently removes its installed folder and app-scoped stored data.

The importer copies each folder into `~/.kucedr/apps/<id>`, excluding `node_modules`. The folder name becomes the ID and must begin with an alphanumeric character, followed only by alphanumeric characters, underscores, or hyphens. Importing an existing ID replaces its application files while preserving its existing `data` directory. Data shipped in the source folder is not imported. A source folder that is already the installed destination is skipped.

**Open folder** opens the managed apps directory; **Refresh** reloads the inventory. Opening an already open app focuses its existing window.

Sources: [Settings Apps](../src/renderer/src/pages/settings/pages/apps/Page.tsx), [importer](../src/main/apps/app_import.ts), [IPC actions and delete confirmation](../src/main/ipc/apps.ts), [window lifecycle](../src/main/apps/app_render.ts).

## Debug an external app folder

In the debug section of **Settings → Apps**, select a folder using the native picker, then add it. Kucedr registers the original folder and runs its entry directly without copying its application files into managed storage. Build the entry first; registering source code does not start a development server.

The selected folder needs a valid manifest and an existing entry file contained within that folder. Folder IDs cannot collide with an installed app or another registered debug folder. A symlink used as the selected folder is rejected, and an entry resolving outside the folder is rejected.

Debug apps have a badge and their registered paths appear in Settings. Removing one unregisters it and closes its window without deleting the source folder. App-scoped SDK data still lives under `~/.kucedr/apps/<id>/data`, rather than the external source folder; unregistering the debug app does not remove that data. Window-setting changes write to the app's manifest, including the external manifest for a debug app.

Sources: [debug registration](../src/main/apps/app_debug_add.ts), [debug removal](../src/main/apps/app_debug_remove.ts), [directory resolution](../src/main/apps/app_directory.ts), [window settings persistence](../src/main/apps/app_write.ts).

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

**Details → Window** controls width, height, minimum dimensions, resizability, and maximization. Changes apply on the next opening of the app window. Host defaults are 820×640 with a 620×480 minimum, resizable and maximizable. Selecting default values removes the custom window section from the manifest.

Sources: [data root](../src/main/shared/user_data_location.ts), [value storage](../src/main/apps/app_values.ts), [file storage](../src/main/apps/app_files.ts), [debug registry](../src/main/apps/app_debug_store.ts), [window settings UI](../src/renderer/src/pages/settings/pages/apps/details/Window.tsx), [window defaults](../src/shared/app_window_settings.ts).

## Troubleshooting

- **App not listed:** ensure its folder name is a valid ID, its manifest validates, and its built entry exists; then refresh Settings Apps.
- **Missing entry:** build the app before importing or registering it. Import excludes `node_modules`, so runtime dependencies must be included in the generated frontend bundle.
- **Source edits do not appear:** an installed app runs its copied files. Rebuild and reimport it, or register an external debug folder after resolving any ID collision.
- **Debug ID already in use:** use a distinct valid folder name or remove the conflicting registration/install after preserving any data you need.
- **Model action fails:** inspect the relevant host provider/model configuration and the reported error. A browser preview has no host SDK runtime.
- **Window settings seem unchanged:** close the existing window and reopen it; opening an already open app only focuses that window.

For repository setup and checks, see [Development](DEVELOPMENT.md). For broader product capabilities, see [Features](FEATURES.md).
