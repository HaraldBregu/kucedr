# Mode backgrounds

A mode can ship an optional animated background that shows behind the chat while the mode is active.
It can be anything from a CSS gradient to a WebGL shader that reacts to the agent's activity. The
effect is plugin content that runs in a sandboxed iframe. `src` has no code for any specific mode's
background.

## Mode folder

```text
plugins/<plugin-name>/modes/<mode-name>/
  manifest.json
  SYSTEM_PROMPT.md
  background/            optional
    index.html           entry point, with a transparent body
    *.js, *.css, ...     scripts, styles, shaders, images, libraries (all local)
```

A simple effect can be an `index.html` with only a `<style>`. A complex one can use canvas, WebGL,
or a library such as three.js, as long as the library is copied into the folder. The frame has no
network access.

## Host

Status: implemented. The bundled `plan` mode ships a WebGL2 matrix rain, and `goal` ships an
ordered-dither noise field. Neither uses a library.

1. **Discover** (`src/main/agent/modes/read.ts`): if `background/index.html` exists, the mode's
   `background` field holds the folder path. `AgentModeInfo.background` is `true` for these modes,
   and the renderer gets it through `useModes()`.
2. **Serve** (`src/main/agent/modes/background.ts`, registered in `src/main/protocol.ts`):
   `kucedr-mode://<mode-id>/<path>` serves only files inside that mode's `background/` folder. Mode
   ids are unique, because the first plugin to claim an id wins. Paths go through `realpath`, so
   `..` and symlinks that lead outside the folder get a 403. Every response gets
   `Content-Security-Policy: default-src 'none'; script-src kucedr-mode: 'unsafe-inline'; …` with no
   `connect-src`, and `Access-Control-Allow-Origin: *` so module scripts load into the opaque origin.
3. **Render** (`src/renderer/src/pages/home/components/ModeBackground.tsx`, mounted as the first
   child of the `relative isolate` home workspace): one `<iframe sandbox="allow-scripts">` per active
   mode with a background, using `pointer-events-none absolute inset-0 -z-10` and
   `[color-scheme:normal]`. The colour-scheme class matters: without it, Chromium paints an opaque
   white backdrop behind a frame whose colour scheme differs from the dark page. With no
   `allow-same-origin`, the frame has an opaque origin, no preload API, no storage, and no access to
   the parent page. The renderer's CSP allows `kucedr-mode:` in `frame-src`.
4. **Lifecycle**: the frame mounts when the mode turns on and unmounts when the mode turns off.
   Several modes with backgrounds stack in `modeIds` order.

## Messages to the frame

The renderer sends messages to the frame with `postMessage`, once when the frame loads and again
whenever a value changes. The frame can't send anything back: the host has no listener for it.

| Message                                                   | Changes when                               |
| --------------------------------------------------------- | ------------------------------------------ |
| `{ type: 'theme', colors: Record<string,string>, dark }`  | The theme, or the root `class`/`style`, changes |
| `{ type: 'motion', reduced: boolean }`                    | The reduced-motion setting changes         |
| `{ type: 'visible', value: boolean }`                     | The window is hidden or shown              |
| `{ type: 'agent', status: AgentRunState }`                | The run status changes: `idle`, `thinking`, `reasoning`, `using_tools`, `awaiting_input`, `answering`, `completed`, `cancelled`, `error` |

`colors` is keyed by token name without the `--` prefix (`primary`, `foreground`, …). Each value is
the CSS variable as the page currently has it, which can be hex, `oklch(...)`, or `var(...)`. To get
RGB for WebGL, paint the value into a 1×1 canvas with `fillStyle` and read the pixel back. `dark`
comes from the page's `dark` class, so it matches what's on screen. A background should stop its
animation loop when it gets `reduced: true` or `visible: false`.

Example plugin `index.html`:

```html
<!doctype html>
<style>html,body{margin:0;height:100%;background:transparent}canvas{width:100%;height:100%}</style>
<canvas></canvas>
<script src="effect.js"></script>
```

```js
let state = { status: 'idle', reduced: false, visible: true, color: '#888' };
addEventListener('message', ({ data }) => {
	if (data.type === 'agent') state.status = data.status;
	if (data.type === 'motion') state.reduced = data.reduced;
	if (data.type === 'visible') state.visible = data.value;
	if (data.type === 'theme') state.color = data.tokens['--primary'];
});
// requestAnimationFrame loop that draws faster while status is 'streaming' or 'tool'
```

## Security

- Plugin JS never runs in the app's renderer. The frame is sandboxed, has an opaque origin, and has
  no preload.
- `connect-src 'none'` and `'self'` sources keep the frame from making network requests or sending
  data out.
- The frame only receives status values, never message content, so a background can't read the
  chat.
- `pointer-events-none` and `aria-hidden` keep the frame from capturing input or focus.

Because of these rules, third-party plugins can ship backgrounds, so the feature isn't bundled-only.

## Cost

A running iframe and animation loop uses CPU and GPU while the mode is on. The host unmounts the
frame when the mode turns off, and the `visible` and `motion` messages let a background pause
itself. The host doesn't throttle frames beyond that.

## Not included

- **Sending message content or tokens to the frame**: add this only with a manifest opt-in and a
  user-facing permission.
- **Frame-to-host messages**, such as an effect that changes the UI: none for now.

## Verification

- `/plan` with a `background/` folder: the effect appears behind the messages, and scrolling, clicks,
  and text selection still work.
- Turn the mode off: the iframe is removed from the DOM.
- A background that calls `fetch('https://…')`: the request is blocked by CSP.
- A path with `../` in `kucedr-mode://`: the server returns 403.
- Light, dark, and plugin themes: the frame receives the new `theme` tokens.
- Reduced motion turned on in macOS, and the window minimised: the effect pauses.
- A streaming run: the frame receives the `thinking` → `streaming` → `done` messages.
