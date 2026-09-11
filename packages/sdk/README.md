# @kucedr/sdk

Typed client for app-data access in Kucedr.

This package exposes typed Kucedr APIs for in-app code and the accompanying remote client
used to call supported APIs over Kucedr's local HTTP bridge.

## Install

```sh
npm install @kucedr/sdk
```

## Usage from another app

Kucedr writes a bearer token to `<userData>/sdk-token` (for example:
`~/Library/Application Support/Kucedr/sdk-token` on macOS).
Read that token and call `connect()` to reach Kucedr over HTTP.

```ts
import { readFileSync } from 'node:fs';
import { connect } from '@kucedr/sdk';

const kucedr = connect({
	token: readFileSync('/Users/me/Library/Application Support/Kucedr/sdk-token', 'utf8').trim(),
});

await kucedr.ping(); // { name: 'kucedr', version: '1.0.0' }

const theme = await kucedr.app.getThemeData();
await kucedr.app.setTheme('dark');

const workspace = await kucedr.agent.getWorkspaceLocation();
const files = await kucedr.agent.listWorkspaceFiles();
const content = await kucedr.agent.readWorkspaceFile('USER.md');
await kucedr.agent.writeWorkspaceMarkdown('USER.md', '# Updated');
await kucedr.agent.writeWorkspaceFile('diagrams/flow.mmd', 'flowchart LR');
await kucedr.agent.createWorkspaceFile('', 'draft.md');
await kucedr.agent.createWorkspaceDirectory('notes', 'ideas');
await kucedr.agent.moveWorkspaceEntry('draft.md', 'notes');
await kucedr.agent.renameWorkspaceEntry('notes/draft.md', 'idea.md');
await kucedr.agent.deleteWorkspaceFile('old.md');
await kucedr.agent.deleteWorkspaceDirectory('archive');
```

File entries returned by `listWorkspaceFiles()` include their byte size and ISO creation and
update timestamps. Directory entries contain their recursive `children` instead.

Streaming callbacks (for `app` events) use the SSE stream opened on first use; call
`kucedr.close()` when finished.

## Usage inside Kucedr

```ts
import { agent, app, coder, isKucedr, models, win, type AppThemeData } from '@kucedr/sdk';

if (!isKucedr()) throw new Error('Not running inside Kucedr');

const themeData: AppThemeData = await app.getThemeData();
await app.setTheme(themeData.themeMode === 'dark' ? 'light' : 'dark');

await app.setAppStoreValue('config', { color: 'blue', autosave: true });
const config = await app.getAppStoreValue<{ color: string; autosave: boolean }>('config');

const encoded = new TextEncoder().encode('app-owned file');
await app.writeAppStoreFile('notes/example.txt', encoded);
const decoded = new TextDecoder().decode(await app.readAppStoreFile('notes/example.txt'));

const workspace = await agent.getWorkspaceLocation();
const files = await agent.listWorkspaceFiles();
const content = await agent.readWorkspaceFile('USER.md');
const image = await agent.readWorkspaceAsset('images/photo.png');
const generated = await models.image.createImage({ prompt: 'A calm, modern reading room' });
const revised = await models.image.createImage({
	prompt: 'Replace only the armchair with a caramel leather lounge chair.',
	source: { base64: generated.base64, mimeType: 'image/png' },
});
await agent.writeWorkspaceMarkdown('USER.md', '# Updated');
await agent.writeWorkspaceFile('diagrams/flow.mmd', 'flowchart LR');
await agent.createWorkspaceFile('', 'draft.md');
await agent.createWorkspaceDirectory('notes', 'ideas');
await agent.moveWorkspaceEntry('draft.md', 'notes');
await agent.renameWorkspaceEntry('notes/draft.md', 'idea.md');
await agent.deleteWorkspaceFile('old.md');
await agent.deleteWorkspaceDirectory('archive');

const settings = await coder.getSettings();
const projects = await coder.listProjects();
const project = projects[0] ?? (await coder.addProject());
if (!project) throw new Error('Choose a Coder project first.');
const result = await coder.send(
	{
		projectId: project.id,
		mode: 'agent',
		input: 'Add focused tests for the current change.',
	},
	(event) => {
		if (event.type === 'text-delta') console.log(event.delta);
	}
);
const sessions = await coder.listSessions(project.id);
const snapshot = await coder.getSession(project.id, result.sessionId);
await coder.openProject(project.id);
await coder.renameSession(project.id, result.sessionId, 'Focused tests');
await coder.deleteSession(project.id, result.sessionId);
const action = await win.showContextMenu([
	{ type: 'role', role: 'copy' },
	{ type: 'separator' },
	{ id: 'open', label: 'Open' },
	{ id: 'copy-path', label: 'Copy Path' },
]);
win.maximize();
const maximized = await win.isMaximized();

win.setTitlebarOptions({
	title: 'Workspace',
	leftButtons: [
		{
			id: 'toggle-sidebar',
			label: 'Collapse sidebar',
			icon: 'panel-left',
			expanded: true,
		},
	],
	rightButtons: [],
	sidebarOpen: true,
	sidebarWidth: 240,
});
const stopTitlebarActions = win.onTitlebarButtonClick((buttonId) => {
	if (buttonId === 'toggle-sidebar') console.log('Toggle the app sidebar');
});
stopTitlebarActions();
```

## App window configuration

Declare initial window settings in the app's `manifest.json`. Kucedr reads the manifest before
creating the window, so these settings take effect before the app's JavaScript runs.

```json
{
	"title": "Notes",
	"description": "A compact notes app",
	"metadata": {
		"version": "1.0.0",
		"category": "utility",
		"entry": "dist/index.html"
	},
	"window": {
		"width": 960,
		"height": 720,
		"minWidth": 480,
		"minHeight": 320,
		"resizable": true,
		"maximizable": true
	}
}
```

Every `window` field is optional. Apps without window configuration keep these defaults:

| Field | Default | Meaning |
| --- | --- | --- |
| `width` | `820` | Initial outer window width |
| `height` | `640` | Initial outer window height |
| `minWidth` | `620` | Minimum outer window width |
| `minHeight` | `480` | Minimum outer window height |
| `resizable` | `true` | Allow the user to resize the window |
| `maximizable` | `true` | Allow the user to maximize the window |

Dimensions are positive integer device-independent pixels, at most `32768`. The outer height
includes Kucedr's 48-pixel titlebar. An explicit minimum cannot exceed its explicit initial
dimension. If an initial dimension is smaller than the default minimum, the omitted minimum
is lowered to fit it.

For apps imported using only `package.json`, put the same object under `kucedr.window`:

```json
{
	"name": "notes",
	"description": "A compact notes app",
	"version": "1.0.0",
	"main": "dist/index.html",
	"kucedr": {
		"window": { "width": 480, "height": 320, "resizable": false }
	}
}
```

When both files exist, `manifest.json` takes precedence. Invalid window configuration is rejected.
The SDK exports `AppManifest`, `AppMetadata`, `App`, `AppWindowSettings`,
`ResolvedAppWindowSettings`, `APP_WINDOW_DEFAULTS`, and `isAppWindowSettings()` for authoring
and validating this configuration. These exports also work outside the Kucedr host.

Users can change each installed app's window preferences under **Settings → Apps → app**.
Saved preferences override the manifest and persist across host restarts and replacement uploads
of the same app ID. Reset restores the current manifest defaults. Changes apply when a new window
is opened; close and reopen an existing app window to use the updated settings.

## What's available

- `app`: app data + settings APIs exposed by preload (`setTheme`, `getThemeData`, `getLanguage`, etc.)
- `agent`: workspace APIs exposed by preload, including text reads, typed asset reads, and Markdown writes.
- `coder`: embedded Pi coding-agent projects, persistent sessions, Agent/Shell runs, settings, authentication, streaming, and cancellation.
- `models`: embedded model APIs, including configured image generation and source-image editing without exposing provider credentials.
- `terminal`: embedded-only, owner-scoped PTY lifecycle, input, resize, output, and exit events.
- `win`: embedded-only window APIs, including native context menus and window controls.
- `connect()`: remote client for the app API and workspace agent APIs.
- `isKucedr()`: host check for in-app mode.
- `ping()`: validate API reachability in remote mode.

`coder` is intentionally embedded-only. `addProject()` opens Kucedr's native folder picker, and all
runs use an opaque main-owned project ID rather than accepting a filesystem path from an app.
Agent conversations persist per project; Shell mode records non-interactive commands in the same
session but is not a PTY. A project's directory is the default cwd, not a security sandbox: coding
tools can execute with the desktop user's authority. Apps receive redacted agent-tool events
and never receive provider credentials. Project opening and session mutation also resolve opaque IDs
inside the main process. The registered Coder app may read and save non-secret runtime settings,
list the Pi model catalog, and run Codex OAuth; other apps are rejected. Coder is not exposed by
`connect()`.

`terminal` is also intentionally embedded-only and is authorized only for trusted Kucedr windows and
the registered Coder app. It exposes the narrow preload bridge; shell selection, PTY ownership,
and process lifecycle remain in the Electron main process. It is not exposed by `connect()`.

App titlebars are rendered by the Kucedr host. Embedded Apps can provide a centered title,
left and right button descriptors, and optional sidebar state with
`win.setTitlebarOptions()`. Button IDs are returned through `win.onTitlebarButtonClick()` so the
app remains the owner of its application state. Passing `null` restores the manifest title and
removes app-provided controls. Icons are selected from the exported
`APP_TITLEBAR_BUTTON_ICONS` list; arbitrary markup is not accepted across the window boundary.
Keep `sidebarWidth` at the expanded width and update `sidebarOpen` when showing or hiding it so the
host titlebar uses the same off-canvas transition as the app sidebar.

App store methods are available only to apps embedded in Kucedr. Kucedr derives the
app namespace from the calling view, so apps never pass or select an app ID.
Values are JSON state stored in plaintext and should not contain passwords or API keys. File paths
are relative to the app's isolated files directory, and file data uses `Uint8Array`.

Value keys must be non-empty strings; prototype-related and internal keys are reserved. A missing
value returns `undefined`. Values must contain only finite numbers, strings, booleans, null, dense
arrays, and plain objects. The generic parameter on `getAppStoreValue()` is a TypeScript
assertion, not runtime schema validation; `isAppStoreValue()` validates only this JSON-safe
shape.

File paths use forward slashes and cannot be absolute, empty, or contain `.` / `..` segments. Writes
atomically replace an existing file, missing-file reads reject, and both delete methods are
idempotent. Stored data is retained when an app is removed, so reinstalling the same
app ID restores its state.

## Development

Run these commands from the repository root:

```sh
npm ci
npm run sdk:build
npm run sdk:test
```

## Publishing

SDK releases use `sdk-v<version>` tags and npm trusted publishing. See the repository
[development and deployment guide](../../docs/DEVELOPMENT.md#release-the-sdk).
