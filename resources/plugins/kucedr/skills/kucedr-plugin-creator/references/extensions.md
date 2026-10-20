# Creating an extension

An extension is a small HTML view that Kucedr shows inside its own window. Today every extension is
listed in the home sidebar under New chat, and clicking it shows the extension in place of the
chat. Use an extension for a focused tool; use an app when it needs its own window.

## How it runs

- The extension's `index.html` loads in an iframe with `sandbox="allow-scripts"`, from
  `kucedr-plugin://<plugin-id>/<extension-id>/index.html`.
- It has no preload, no Node, and no access to Kucedr's internal APIs or storage.
- Every file is served with a Content Security Policy that allows only:
  - scripts and stylesheets from the extension folder
  - inline styles
  - images and fonts from the folder or `data:` URLs

  Inline `<script>` blocks, `fetch` or WebSocket calls to other origins, and remote images, fonts
  or scripts are all blocked.
- There's no messaging bridge to Kucedr yet, so an extension works only with what it bundles and
  what the user types into it.

## Steps

1. **Pick the extension id:** lowercase kebab-case. Create `extensions/<extension-id>/`.
2. **Write `index.html`**, and put every script in a separate `.js` file referenced with a relative
   path.
3. **Add `style.css`.** Keep the layout full-height, because the extension fills the chat area.
4. **Write `manifest.json`** with the title, description, slot, and optional icon.
5. **Add an icon** (optional): a png, svg, jpg, or webp file of 256 KB at most, in the extension
   folder. It's shown in the home sidebar at 16 px, so keep it simple.
6. **Test:** install the plugin, open Home, and click the extension under New chat.

## manifest.json

```json
{
	"title": "Word counter",
	"description": "Counts the words in pasted text.",
	"slot": "panel",
	"icon": "icon.svg"
}
```

- `title` and `description` are required. The title is the sidebar label, and the description is
  its tooltip.
- `slot` is `sidebar`, `panel`, `toolbar`, `composer`, or `settings`. Pick the place that fits
  best: Kucedr records it for future placement, but currently ignores it.

## Minimal extension

`index.html`:

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<title>Word counter</title>
		<link rel="stylesheet" href="style.css" />
	</head>
	<body>
		<textarea id="text" placeholder="Paste text…" aria-label="Text"></textarea>
		<p id="count" aria-live="polite">0 words</p>
		<script src="script.js"></script>
	</body>
</html>
```

`style.css`:

```css
body {
	display: flex;
	flex-direction: column;
	gap: 8px;
	height: 100vh;
	margin: 0;
	padding: 12px;
	box-sizing: border-box;
	font: 14px system-ui, sans-serif;
}

textarea {
	flex: 1;
	padding: 8px;
	resize: none;
	font: inherit;
}
```

`script.js`:

```js
const text = document.getElementById('text');
const count = document.getElementById('count');

text.addEventListener('input', () => {
	const words = text.value.trim() ? text.value.trim().split(/\s+/).length : 0;
	count.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
});
```

## Checklist

- The folder has `manifest.json` and `index.html`.
- No inline scripts, no network calls, and no remote assets.
- Every path is relative and stays inside the extension folder.
- The page works at any width, because the chat area resizes with the window.
