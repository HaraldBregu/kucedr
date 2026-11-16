# Plugin themes

Themes are contributed by plugins and selected in Settings → General. The built-in default remains available, and the existing Light, Dark, and System control selects the variant of the active theme.

## Implementation

- Discover and validate `themes/<id>/manifest.json` contributions, including theme-only plugins.
- Expose theme names and plugin ownership to Settings and plugin details. Persist the selected plugin and theme IDs.
- Apply the selected variant through the app theme data path. Fill omitted tokens from the built-in theme and clear stale overrides when switching.
- Refresh themes after plugin changes. Use the built-in theme when the saved selection is unavailable, and restore it when available again.
- Bundle AstroVista in Bootstrap with the supplied light and dark styles.

## Verification

Check validation, discovery, ownership, persistence, variant switching, fallback, and plugin lifecycle changes. In Electron, verify the selector, plugin detail list, immediate appearance, restart persistence, and keyboard access.
