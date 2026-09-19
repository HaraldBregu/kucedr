# Apps

Kucedr opens local HTML applications in dedicated desktop windows. Manage them in **Settings → Apps**. This checkout contains four app implementations: Coder, Workspace, Discover, and Demo. Source folders are not automatically installed at startup; install a built folder or register it as a debug app.

## Application inventory

| App | Purpose | Source |
| --- | --- | --- |
| Coder | Project-based coding agent, persistent sessions, and recorded shell commands | [Coder](../resources/apps/coder/) |
| Workspace | Browse, edit, and preview files in the agent workspace | [Workspace](../resources/apps/workspace/) |
| Discover | Turn a research question into an AI discovery brief | [Discover](../resources/apps/discover/) |
| Demo | Exercise SDK theme, language, model, and storage APIs | [Demo](../resources/apps/demo/) |
| Architect | A build-script reference remains, but the app source directory is absent | [Root scripts](../package.json) |
| Videomaker | A build-script reference remains, but the app source directory is absent | [Root scripts](../package.json) |

The four implemented apps declare version `1.0.0` and the entry `dist/index.html`. Architect and Videomaker cannot be built from their referenced directories in this checkout; they are not documented as working apps.

## Install, open, and remove an app

1. Obtain an app folder containing a valid `manifest.json` or supported `package.json`, plus its built entry file. For repository apps, run the corresponding root script, such as `npm run build:workspace`, before selecting the source folder.
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

## Coder

Coder uses the Pi coding runtime and keeps work organized by project and session.

1. Open Coder and its configuration view. Choose a provider and model, thinking level, and tool mode. Supported provider IDs are `openai-codex`, `openai`, and `anthropic`; the displayed catalog determines available models.
2. For OpenAI Codex, use the connection action and finish the browser authentication flow. The configuration view also supports cancelling login and disconnecting.
3. Add an external project using the folder picker, or select the agent workspace project. Expand a project to select a saved session or start a new one.
4. Submit an agent request, or select shell mode to run a command. The conversation shows messages, tool activity, command output, exit state, and truncation indicators. Cancel stops the active run.
5. Use project files and instructions to inspect the project and edit its active instruction file. When no project-level instruction file exists, the editor targets `AGENTS.md` in the project root. Saving checks the prior revision to detect concurrent edits.

The default configuration has no model selected and uses the `read-only` tool mode. Choose `coding` when the coding agent should have write-capable tools. Agent and shell are distinct run modes; do not interpret the agent tool-mode setting as a promise that every shell command is read-only.

Keyboard shortcuts include **Cmd/Ctrl+N** for a new session and **Cmd/Ctrl+/** to focus the composer. Project/session switching is disabled during a run. Outside the Kucedr host, Coder renders sample preview content; it does not demonstrate a live coding session.

Coder runtime state resides under `~/.kucedr/coder/pi`, with sessions in its `sessions` directory and settings in `~/.kucedr/settings/coder.json`. This is separate from the app-scoped store used for UI preferences such as the active project and sidebar state.

Sources: [workspace controller](../resources/apps/coder/src/hooks/workspace.ts), [configuration](../resources/apps/coder/src/hooks/configuration.ts), [instruction handling](../src/main/coding/instructions.ts), [default settings](../src/main/coding/store.ts), [runtime paths](../src/main/coding/location.ts), [coding types](../src/shared/coding_types.ts).

## Workspace

Workspace is a file browser and editor for the agent workspace. It uses the host workspace APIs, so it requires the Kucedr runtime to load real workspace files.

Select a file in the tree to open it. The app supports creating files and folders, renaming, duplicating files, moving entries, and deleting entries with confirmation. Deletion is permanent. Search filters the displayed tree. Workspace changes from the host refresh the file list.

| File type | Available interaction |
| --- | --- |
| Markdown | Source editing and formatted preview |
| Text/code | CodeMirror editor with font size, line number, and wrapping preferences |
| Mermaid | Diagram source editing and preview |
| Excalidraw / tldraw | Drawing editors |
| Images | Preview, copy image, and copy path |
| Audio / video | Playback controls |
| PDF | Embedded PDF viewer |
| Unsupported files | Explicit preview-unavailable message |

Editable content is saved automatically after a short pause (700 ms), with save errors surfaced in the UI. The app also coordinates saving before changing selection or closing; attend to any unsaved-change warning before leaving. Media previews use the host's `local-resource://agent/` resource access.

Sources: [Workspace application](../resources/apps/workspace/src/App.tsx), [file viewers](../resources/apps/workspace/src/components/viewer.tsx), [editor settings](../resources/apps/workspace/src/lib/settings.ts).

## Discover

Enter a question and select **Explore**. Discover asks the Kucedr agent for a concise brief covering market or trend context, signals to validate, players or segments, and three follow-up research questions. Its request uses minimal context and allows the `web_search` tool, asking for current research and citations when appropriate. Actual research depends on the host's model and tool configuration.

Topic cards and research-direction buttons fill the question field. **New research** clears the question, brief, and error state. The app follows the host theme and supports English and Italian interface copy.

The brief is held only in the current window's React state. There is no implemented saved-research store or history. The **Overview**, **Trends**, **Markets**, and **Saved** navigation buttons are presentational in the current source, and the bookmark icon does not save a brief. Research is disabled outside Kucedr.

Source: [Discover application](../resources/apps/discover/src/App.tsx).

## Demo

Demo is an SDK integration playground. Open it inside Kucedr to:

- Read or change light, dark, and system theme settings and inspect theme data.
- Read or change the host language between English and Italian.
- Exercise text generation, embeddings, speech synthesis, transcription, image, sound, video, and realtime voice APIs using configured host providers.
- Store, load, or delete a JSON-compatible app value by key.
- Write, read, or delete an app-scoped binary file, with a text editor provided for the example.
- Run the included storage test and inspect its results.

Model actions require their corresponding provider configuration and may invoke paid remote services. The presence of a test button does not mean that capability is configured. Theme and language setters change host settings; they are not isolated preview controls. Host-dependent actions report that the runtime is missing when opened in a normal browser.

Sources: [Demo application](../resources/apps/demo/src/App.tsx), [model examples](../resources/apps/demo/src/models.tsx), [storage test](../resources/apps/demo/src/storage.ts).

## Storage and window reference

| Location | Contents |
| --- | --- |
| `~/.kucedr/apps/<id>/` | Installed app files |
| `~/.kucedr/apps/<id>/data/store.json` | App-scoped key/value data |
| `~/.kucedr/apps/<id>/data/` | App-scoped files |
| `~/.kucedr/settings/apps-debug.json` | Registered external app paths |
| External debug folder | Debug app source/build and manifest |

The data root can be overridden by `KUCEDR_E2E_DATA_ROOT` for tests. App-scoped file and value APIs validate IDs and reject invalid storage paths or symlink storage directories.

**Details → Window** controls width, height, minimum dimensions, resizability, and maximization. Changes apply on the next opening of the app window. Host defaults are 820×640 with a 620×480 minimum, resizable and maximizable. Coder and Discover provide their own manifest dimensions. Selecting default values removes the custom window section from the manifest.

Sources: [data root](../src/main/shared/user_data_location.ts), [value storage](../src/main/apps/app_values.ts), [file storage](../src/main/apps/app_files.ts), [debug registry](../src/main/apps/app_debug_store.ts), [window settings UI](../src/renderer/src/pages/settings/pages/apps/details/Window.tsx), [window defaults](../src/shared/app_window_settings.ts).

## Troubleshooting

- **App not listed:** ensure its folder name is a valid ID, its manifest validates, and its built entry exists; then refresh Settings Apps.
- **Missing entry:** build the app before importing or registering it. Import excludes `node_modules`, so runtime dependencies must be included in the generated frontend bundle.
- **Source edits do not appear:** an installed app runs its copied files. Rebuild and reimport it, or register an external debug folder after resolving any ID collision.
- **Debug ID already in use:** use a distinct valid folder name or remove the conflicting registration/install after preserving any data you need.
- **Model action fails:** inspect the relevant host provider/model configuration and the reported error. A browser preview has no host SDK runtime.
- **Window settings seem unchanged:** close the existing window and reopen it; opening an already open app only focuses that window.

For repository setup and checks, see [Development](DEVELOPMENT.md). For broader product capabilities, see [Features](FEATURES.md).
