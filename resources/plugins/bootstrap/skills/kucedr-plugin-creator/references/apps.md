# Creating an app

An app is a self-contained HTML application. Its manifest `mode` picks where it opens:

- `extension` (default): in place of the chat on Kucedr's home page, in a sandboxed iframe with
  no network access, no inline scripts, and no `@kucedr/sdk`. It can keep key-value data by
  posting `{ kucedrStore: <id>, op: 'get' | 'set' | 'delete', key, value }` to `window.parent`;
  the reply is `{ kucedrStore, value }`.
- `window`: in its own sandboxed Kucedr window, talking to Kucedr through the `@kucedr/sdk`
  bridge.
- `both`: in place of the chat by default, plus an **Open in new window** action. Both modes
  share the same store, so write code that works without the SDK (see Triangle's `store.js` in
  the core plugin).

## Steps

1. **Pick the app id:** lowercase kebab-case, unique within the plugin. Create
   `apps/<app-id>/`.
2. **Build the app.**
   - For a small app, write `index.html`, `style.css`, and `script.js` by hand.
   - For a larger one, build it in a separate project (any bundler) and copy only the built output
     into the app folder.
   - Use relative paths for every asset.
3. **Write `manifest.json`** in the app folder (fields below).
4. **Add an optional icon:** a png, jpg, webp, avif, or svg file inside the app folder, referenced
   from `metadata.image`. Settings → Apps, the command menu, and the home sidebar show it.
5. **Pick `mode`**, and for `window` or `both` set the window size only if the defaults
   (820 × 640, minimum 620 × 480, resizable) don't fit.
6. **Test** by installing the plugin, then opening the app from the Apps list.

## manifest.json

```json
{
	"title": "Acme Dashboard",
	"description": "Account usage and status at a glance.",
	"mode": "window",
	"metadata": {
		"version": "1.0.0",
		"category": "productivity",
		"entry": "index.html",
		"image": "cover.png"
	},
	"window": { "width": 960, "height": 720, "minWidth": 640, "minHeight": 480 }
}
```

- `title`, `description`, `metadata.version`, `metadata.category`, and `metadata.entry` are
  required.
- `mode` is `extension`, `window`, or `both`; leave it out for `extension`.
- `entry` is a relative path to an `.html` file that exists. It can't start with `/` or contain
  `..`.
- `window` (used only by `window` and `both`) accepts `width`, `height`, `minWidth`, `minHeight`, `resizable`, `maximizable`,
  `frame`, `transparent`, `alwaysOnTop`, `type` (`normal`, `panel`, `toolbar`), and
  `titleBarStyle` (`hidden`, `hiddenInset`, `default`; macOS only).
  Sizes describe the whole window, including Kucedr's navigation bar.

## Minimal app

`index.html`:

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<title>Acme Dashboard</title>
		<link rel="stylesheet" href="style.css" />
	</head>
	<body>
		<main>
			<h1>Acme Dashboard</h1>
			<p id="status">Ready.</p>
		</main>
		<script src="script.js"></script>
	</body>
</html>
```

`script.js`:

```js
document.getElementById('status').textContent = `Opened ${new Date().toLocaleString()}.`;
```

## Using Kucedr from the app

To read the theme or language, store app data, run models, or work with the agent's workspace,
build the app with the `@kucedr/sdk` bridge. Follow the `kucedr-app-creator` skill for the API,
the build setup, and its limits. Ship only the built files (for example `dist/`), and point
`metadata.entry` at the built HTML.

## Checklist

- The folder name is the app id.
- `manifest.json` has every required field, and `entry` points to an existing `.html` file.
- `metadata.image`, when set, is an image inside the app folder.
- No `node_modules`, source maps you don't want to ship, or symlinks.
