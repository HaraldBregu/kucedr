# Theme contributions

A theme is one `manifest.json` in `themes/<id>/` holding two token maps, one for light mode and one for dark mode. The user picks the theme in Settings → General; the Light, Dark and System setting there decides which map applies.

The folder name is the theme id.

## manifest.json

```json
{
	"id": "harbor",
	"title": "Harbor",
	"light": {
		"background": "oklch(0.98 0.005 240)",
		"foreground": "oklch(0.25 0.02 250)",
		"primary": "oklch(0.55 0.14 245)",
		"primary-foreground": "oklch(1 0 0)"
	},
	"dark": {
		"background": "oklch(0.22 0.02 250)",
		"foreground": "oklch(0.93 0.01 240)",
		"primary": "oklch(0.70 0.13 245)",
		"primary-foreground": "oklch(0.18 0.02 250)"
	}
}
```

Rules, all enforced:

- `id` must equal the folder name.
- `title` is a non-empty string.
- `light` and `dark` must both be present and be objects. Either may be empty.
- A token name starts with a lowercase letter and continues with lowercase letters, digits or hyphens. Write it without the leading `--`.
- A token value is a non-empty string that contains none of `;`, `{`, `}`. It is used as a CSS property value.

A token you leave out keeps the app's built-in value, so a theme can change as little as one colour.

## Tokens

Colour pairs. Each surface has a matching `-foreground` for text drawn on it:

| Token | Used for |
|---|---|
| `background`, `foreground` | Page background and default text |
| `card`, `card-foreground` | Panels and cards |
| `popover`, `popover-foreground` | Menus, dialogs, tooltips |
| `primary`, `primary-foreground` | Main buttons and highlights |
| `secondary`, `secondary-foreground` | Secondary buttons |
| `muted`, `muted-foreground` | Subdued surfaces and secondary text |
| `accent`, `accent-foreground` | Hover and selected states |
| `destructive`, `destructive-foreground` | Delete and error actions |
| `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring` | The sidebar |

Single colours: `border`, `input`, `ring`, and `chart-1` to `chart-5`.

Window surfaces: `app-window-background-base`, `app-surface-background-base`, `app-popover-background-base`, `app-sidebar-background-base`. Set them to the same values as `background`, `card`, `popover` and `sidebar` unless the user wants them to differ.

Shape and type: `radius` (for example `0.5rem`), `spacing`, `tracking-normal`, `font-sans`, `font-serif`, `font-mono`.

Shadows: `shadow-2xs`, `shadow-xs`, `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`, plus the parts `shadow-color`, `shadow-opacity`, `shadow-x`, `shadow-y`, `shadow-blur`, `shadow-spread`.

## Design rules

- Write colours as `oklch(L C H)`; hex and other CSS colour forms are also valid values.
- Define every colour you change in both maps. A token set only in `light` falls back to the built-in dark value in dark mode, which rarely matches.
- Keep text readable: each `-foreground` must contrast strongly with its surface. As a guide, keep at least 0.45 difference in OKLCH lightness between a surface and its foreground.
- In dark mode, raise the lightness of `primary` and lower its chroma slightly compared with light mode.
- Keep `border` and `input` close to the background, and `ring` close to `primary`.
- A font token only names a font. The theme cannot ship or download font files, so name fonts the user has installed and end the list with a generic family: `"Inter, system-ui, sans-serif"`.
- For a complete theme, set all colour pairs, the single colours, the four window surfaces and `radius`. For a recolour, the four tokens in the example above plus `ring` and the sidebar pair are usually enough.

## Checks

1. The file parses as JSON, and `id` equals the folder name.
2. No value contains `;`, `{` or `}`, and no token name starts with `--` or has uppercase letters:

```bash
grep -n -E '"--|:[[:space:]]*"[^"]*[;{}]|"[^"]*[A-Z][^"]*"[[:space:]]*:' <id>/themes/<theme-id>/manifest.json
```

This must print nothing when the file has one token per line. Capitals are fine in values such as font names; only token names are checked for them.

3. Every token that appears in `light` also appears in `dark`, and the reverse.

After install, the theme appears in the theme picker in Settings → General. An invalid theme manifest is left out without a message. If the plugin is later disabled or removed while its theme is selected, the app falls back to the built-in theme.

Ask the user to select the theme, switch between light and dark, and report anything hard to read. Adjust the two maps and copy the plugin again.
