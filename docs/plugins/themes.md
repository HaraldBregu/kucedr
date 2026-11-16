# Plugin themes

A plugin can contribute themes in `themes/<id>/manifest.json`. Each theme has an ID, title, and light and dark token maps. The folder name and ID match. Token names omit the leading `--`; values are CSS property values. Missing tokens use the built-in theme values.

```json
{
	"id": "example",
	"title": "Example",
	"light": { "primary": "oklch(0.6 0.15 40)" },
	"dark": { "primary": "oklch(0.7 0.15 40)" }
}
```

Select a theme in Settings → General. The existing Light, Dark, and System setting controls which variant is applied. The Bootstrap plugin includes AstroVista as a complete example. If a selected plugin is disabled or removed, the app uses the built-in theme until the selection is available again.
