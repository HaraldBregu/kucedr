# @kucedr/sdk

Build embedded apps that use Kucedr's typed data, workspace, model, and window APIs.
See the [Apps guide](../../docs/APPS.md) for the host workflow and the
[project overview](../../README.md) for Kucedr itself.

This package exposes typed Kucedr APIs for embedded app windows and an optional HTTP client
for a separately supplied compatible server.

## Install

```sh
npm install @kucedr/sdk
```

## Optional HTTP client

`connect()` speaks a bearer-token HTTP protocol to a compatible server, defaulting to
`http://127.0.0.1:8765`. The current Kucedr desktop runtime does not start that server or
write an SDK token, so `connect()` cannot reach this checkout by itself. Use the embedded
bridge below for an app window. If you supply a compatible server separately, pass its URL
and bearer token to `connect()`; close the client when finished with event subscriptions.

## Usage inside Kucedr

```ts
import { agent, app, isKucedr, models, win, type AppThemeData } from '@kucedr/sdk';

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
const answer = await models.text.generateText({ prompt: 'Explain this room in one sentence.' });
const vectors = await models.embedding.createEmbedding({ texts: [answer] });
const narration = await models.voice.synthesize({ text: answer });
const transcription = await models.transcribe.transcribe({
	audio: { data: narration.audio, encoding: 'base64', mimeType: narration.mimeType },
});
const ambience = await models.sound.createSound({ prompt: 'Quiet rain outside a reading room' });
const clip = await models.video.createVideo({ prompt: 'A slow camera move through the room' });
await agent.writeWorkspaceMarkdown('USER.md', '# Updated');
await agent.writeWorkspaceFile('diagrams/flow.mmd', 'flowchart LR');
await agent.createWorkspaceFile('', 'draft.md');
await agent.createWorkspaceDirectory('notes', 'ideas');
await agent.moveWorkspaceEntry('draft.md', 'notes');
await agent.renameWorkspaceEntry('notes/draft.md', 'idea.md');
await agent.deleteWorkspaceFile('old.md');
await agent.deleteWorkspaceDirectory('archive');

const action = await win.showContextMenu([
	{ type: 'role', role: 'copy' },
	{ type: 'separator' },
	{ id: 'open', label: 'Open' },
	{ id: 'copy-path', label: 'Copy Path' },
]);
win.maximize();
const maximized = await win.isMaximized();

win.setNavigationBarOptions({
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
const stopNavigationBarActions = win.onNavigationBarButtonClick((buttonId) => {
	if (buttonId === 'toggle-sidebar') console.log('Toggle the app sidebar');
});
stopNavigationBarActions();
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

| Field         | Default | Meaning                               |
| ------------- | ------- | ------------------------------------- |
| `width`       | `820`   | Initial outer window width            |
| `height`      | `640`   | Initial outer window height           |
| `minWidth`    | `620`   | Minimum outer window width            |
| `minHeight`   | `480`   | Minimum outer window height           |
| `resizable`   | `true`  | Allow the user to resize the window   |
| `maximizable` | `true`  | Allow the user to maximize the window |

Dimensions are positive integer device-independent pixels, at most `32768`. Apps start without a host navigationbar. Enabling it with `win.setNavigationBarOptions()`
reserves 48 pixels of the window content height. An explicit minimum cannot exceed its explicit initial
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
- `coder` / `coding`: embedded Coder APIs for Pi, Codex, and Cline runtimes, projects, persistent
  sessions, Agent/Shell runs, settings, authentication, streaming, and cancellation.
- `models`: embedded model APIs for LLM text, embeddings, STT, TTS, realtime voice, image, audio, and video without exposing provider credentials.
- `terminal`: trusted-host-only, owner-scoped PTY lifecycle, input, resize, output, and exit events.
- `win`: embedded-only window APIs, including native context menus and window controls.
- `connect()`: optional HTTP client for the app API and workspace agent APIs; it requires a separately supplied compatible server.
- `isKucedr()`: host check for in-app mode.
- `ping()`: validate API reachability in remote mode.

`coder` and its `coding` alias are embedded-only and available to trusted Kucedr host renderers
and the registered Coder app (`coder`). Other installed apps are rejected for every Coder operation.
Neither alias is exposed by `connect()`.

`addProject()` opens the native folder picker; an explicit project-creation input can create an
agent workspace. Subsequent project operations resolve main-owned IDs. Agent sessions persist per
project; Shell mode records non-interactive commands and is separate from the PTY API. The project
directory is the default working directory, not a security sandbox: coding tools can execute with
the desktop user's authority. Apps receive redacted tool events rather than provider credentials.

`terminal` is authorized only for trusted Kucedr host renderers. All installed app views, including
the Coder app, are rejected. Shell selection, PTY ownership, and process lifecycle remain in the
Electron main process. It is not exposed by `connect()`.

App navigationbars are rendered by the Kucedr host. Embedded Apps can provide a centered title,
left and right button descriptors, and optional sidebar state with
`win.setNavigationBarOptions()`. Button IDs are returned through `win.onNavigationBarButtonClick()` so the
app remains the owner of its application state. Passing `null` hides the app navigationbar and restores
the full content area. Icons are selected from the exported
`APP_NAVIGATION_BAR_BUTTON_ICONS` list; arbitrary markup is not accepted across the window boundary.
Keep `sidebarWidth` at the expanded width and update `sidebarOpen` when showing or hiding it so the
host navigationbar uses the same off-canvas transition as the app sidebar.

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
