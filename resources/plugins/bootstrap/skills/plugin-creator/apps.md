# App contributions

An app is a folder of static web files in `apps/<id>/` with an HTML entry. Kucedr shows it inside the main window or in its own desktop window. The app never runs a build or a dev server: ship finished HTML, CSS and JavaScript.

The folder name is the app id. It starts with a letter or digit and continues with letters, digits, `_` or `-`. Use lowercase with hyphens.

## Folder

```
apps/<id>/
  manifest.json
  index.html
  app.js
  style.css
  icon.svg
```

## manifest.json

```json
{
	"title": "Counter",
	"description": "A click counter that remembers its value.",
	"mode": "window",
	"metadata": {
		"version": "1.0.0",
		"category": "utility",
		"entry": "index.html",
		"image": "icon.svg"
	},
	"window": { "width": 420, "height": 560, "resizable": true }
}
```

| Field | Required | Rule |
|---|---|---|
| `title` | yes | Non-empty. |
| `description` | yes | Non-empty. |
| `handle` | no | `@` followed by a letter or digit, then letters, digits, `.`, `_` or `-`. |
| `author` | no | Non-empty string. |
| `mode` | no | `extension`, `window` or `both`. Default `extension`. |
| `metadata.version` | yes | Non-empty. |
| `metadata.category` | yes | Non-empty, for example `games`, `productivity`, `utility`. |
| `metadata.entry` | yes | Relative path ending in `.html`. The file must exist. |
| `metadata.image` | no | Relative path to an `avif`, `jpg`, `jpeg`, `png`, `svg` or `webp` icon in the app folder. |
| `window` | no | Window options below. Any other key inside it makes the manifest invalid. |

Paths use `/`, are relative to the app folder, and contain no `..`, `.` or empty segments.

`window` options, all optional:

| Key | Type | Default |
|---|---|---|
| `width`, `height` | integer 1-32768 | 820, 640 |
| `minWidth`, `minHeight` | integer 1-32768, not larger than `width` / `height` when both are given | 620, 480 |
| `resizable`, `maximizable` | boolean | `true` |
| `frame` | boolean | `true` |
| `transparent` | boolean | `true` |
| `alwaysOnTop` | boolean | `false` |
| `type` | `normal`, `panel` (macOS) or `toolbar` (Windows, Linux) | `normal` |
| `titleBarStyle` | `hidden`, `hiddenInset` or `default` | `default` |

If you set a `width` or `height` below the default minimum, set `minWidth` or `minHeight` to match.

## Choosing the mode

| `mode` | Where it opens | Constraints |
|---|---|---|
| `extension` | Inside the main window, in place of the chat | Sandboxed frame. No network. No inline `<script>`. No `window.app` object. |
| `window` | Its own desktop window | Uses the `window` options. `window.app` is available. |

Pick `window` for a tool the user keeps open beside the chat, `extension` for something they use briefly in place. `both` is accepted by the manifest for an app written to work either way.

## Writing the page

Write for the stricter `extension` rules unless the app is `window`-only. They are also good practice in a window:

- Put all JavaScript in separate files loaded with `<script src="app.js"></script>`. Inline scripts and inline event attributes (`onclick="..."`) do not run in extension mode.
- Inline `<style>` and separate stylesheets both work.
- Load every script, stylesheet, font, image and sound from the app folder by relative path. Nothing can be fetched from the internet in extension mode: no CDN links, no web fonts, no API calls.
- Do not depend on a framework build unless you bundle it into the shipped files yourself.
- Support light and dark with `@media (prefers-color-scheme: dark)`.

```html
<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Counter</title>
	<link rel="stylesheet" href="style.css">
</head>
<body>
	<button id="count">0</button>
	<script src="store.js"></script>
	<script src="app.js"></script>
</body>
</html>
```

## Saving data

Each app has a private key/value store kept by Kucedr. It is the same store in both modes, reached in two ways:

- In a window: `await window.app.getAppStoreValue(key)` and `await window.app.setAppStoreValue(key, value)`.
- In extension mode: post a request to the host and wait for the reply with the same request id.

A `store.js` that works in both:

```js
const pending = new Map();
let next = 1;

window.addEventListener('message', (event) => {
	const reply = event.data;
	const done = reply && pending.get(reply.kucedrStore);
	if (!done) return;
	pending.delete(reply.kucedrStore);
	if (reply.error) done.reject(new Error(reply.error));
	else done.resolve(reply.value);
});

function request(op, key, value) {
	return new Promise((resolve, reject) => {
		const id = next++;
		pending.set(id, { resolve, reject });
		window.parent.postMessage({ kucedrStore: id, op, key, value }, '*');
	});
}

window.store = {
	get: (key) => (window.app ? window.app.getAppStoreValue(key) : request('get', key)),
	set: (key, value) => (window.app ? window.app.setAppStoreValue(key, value) : request('set', key, value)),
};
```

`op` is `get`, `set` or `delete`. Store JSON values only. Do not rely on `localStorage`.

## Checks

1. `manifest.json` parses; `metadata.entry` ends in `.html` and exists; `metadata.image`, if set, exists.
2. Search the app for things that fail in extension mode:

```bash
cd <id>/apps/<app-id> && grep -n -E "<script>|<script [^>]*>[^<]|on[a-z]+=\"|https?://" *.html *.js *.css
```

Every hit must be either removed or known to be harmless (an `https://` inside a comment, an SVG namespace). Skip this for a `window`-only app that needs the network.

3. Every file referenced from the HTML exists in the folder.

After install, the app appears in Settings → Apps, tagged with the plugin, and opens from there. An app with an invalid manifest or missing entry is left out of the list without a message. A plugin app cannot be deleted on its own; the user disables or removes the plugin.

While developing, the user can also register the app folder directly in the debug section of Settings → Apps and reopen it after each edit, without installing the plugin.
