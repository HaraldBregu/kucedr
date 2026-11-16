# Mode backgrounds

A mode can ship an optional background effect that shows behind the chat while the mode is active,
such as a tint for `/plan` or a slow animated gradient for `/goal`. The effect is plugin data. `src`
has no code for any specific mode's background.

## Mode folder

`BACKGROUND.css` is an optional file in the mode folder:

```text
plugins/<plugin-name>/modes/<mode-name>/
  manifest.json
  SYSTEM_PROMPT.md
  BACKGROUND.css        optional: the chat background while this mode is active
```

The CSS styles one host element, `.mode-background`. It can use gradients, `@keyframes`, filters,
blend modes, and anything else that works without JS:

```css
.mode-background {
	background: radial-gradient(circle at 20% 0%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 60%);
	animation: drift 12s ease-in-out infinite alternate;
}
@keyframes drift {
	to { background-position: 40% 20%; }
}
```

Use theme tokens such as `var(--primary)` and `var(--background)` so the effect follows light, dark,
and plugin themes.

## Host

1. **Read** (`src/main/agent/modes/read.ts`): if `BACKGROUND.css` exists, read it. Cap it at 16 KB.
   Reject it if it contains `url(`, `@import`, `image-set(`, or `@font-face`. That keeps it offline:
   no network requests and no reads from the filesystem. Validate it with the same error path as
   `SYSTEM_PROMPT.md`.
2. **Expose** (`info.ts`, `AgentModeInfo` in `src/shared/agent_types.ts`): add `background?: string`.
   The renderer already gets it through `useModes()`.
3. **Render** (home chat container in `src/renderer/src/pages/home/Page.tsx`): for each active mode
   id that has a `background`, render the following as the first child of the chat container:

   ```tsx
   <div className="mode-background" data-mode={id} aria-hidden />
   <style>{`@scope ([data-mode="${id}"]) { ${background} }`}</style>
   ```

   The container needs `relative isolate`, and the layer needs `absolute inset-0 -z-10
   pointer-events-none`. `@scope` keeps the plugin's CSS from leaking into the rest of the app.
   Messages, input, and scrolling stay unchanged on top of the layer.
4. **Motion**: wrap the layer in `motion-safe:`, or add a global
   `@media (prefers-reduced-motion: reduce) { .mode-background { animation: none } }`.
5. **Combining modes**: each active mode renders its own layer, in `modeIds` order. If several
   modes have backgrounds, they stack.

## Security

CSS runs in the renderer, so it is not "plugin code in main", and it cannot run script. The `url()`
and `@import` ban stops a third-party background from loading remote resources or tracking pixels.
`@scope` and the fixed `.mode-background` element stop it from restyling the UI. Because of these
two rules, third-party plugins can use the field too, so it is not bundled-only.

## Not included

- **JS or canvas animations** (particles, WebGL): these need a sandboxed iframe like `kucedr-app://`.
  Add them only if CSS turns out to be too limited.
- **Image backgrounds**: these need a plugin-asset URL scheme and an allow-list for `url()` that
  points at it.

## Verification

- Turn on `/plan` with a `BACKGROUND.css`. The effect appears behind the messages, and clicks and
  text selection still work.
- Turn the mode off, or send a message with a non-persistent mode. The effect goes away.
- A file with `url(` fails plugin validation and shows the error in plugin details.
- Light, dark, and plugin themes: the effect uses the theme tokens.
- With reduced motion turned on in macOS settings, the animation stops.
