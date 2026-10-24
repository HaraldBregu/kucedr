# Creating an app

An app is a self-contained HTML application that opens in its own Kucedr window. It runs in a
sandboxed renderer with no Node access and talks to Kucedr only through the `@kucedr/sdk` bridge.

## Steps

1. **Pick the app id:** lowercase kebab-case, unique within the plugin. Create
   `apps/<app-id>/`.
2. **Build the app.**
   - For a small app, write `index.html`, `style.css`, and `script.js` by hand.
   - For a larger one, build it in a separate project (any bundler) and copy only the built output
     into the app folder.
   - Use relative paths for every asset.
3. **Write `manifest.json`** in the app folder (fields below).
4. **Add an optional image:** a png, jpg, webp, or avif file inside the app folder, referenced from
   `metadata.image`. SVG isn't accepted here.
5. **Set the window size** only if the defaults (820 × 640, minimum 620 × 480, resizable) don't
   fit.
6. **Test** by installing the plugin, then opening the app from the Apps list.

## manifest.json

```json
{
	"title": "Acme Dashboard",
	"description": "Account usage and status at a glance.",
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
- `entry` is a relative path to an `.html` file that exists. It can't start with `/` or contain
  `..`.
- `window` accepts `width`, `height`, `minWidth`, `minHeight`, `resizable`, `maximizable`,
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
- `metadata.image`, when set, is a raster image inside the app folder.
- No `node_modules`, source maps you don't want to ship, or symlinks.
