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

1. **Discover** (`src/main/agent/modes/read.ts`): if `background/index.html` exists, the mode has a
   background. Add `background: boolean` to `AgentModeInfo` in `src/shared/agent_types.ts`. The
   renderer already gets it through `useModes()`.
2. **Serve** (`src/main/protocol.ts`): add a `kucedr-mode://<plugin>/<mode>/<path>` scheme. It serves
   only files inside that mode's `background/` folder, with the same outside-the-folder check as
   `appResourceUrl`. Every response gets this header:
   `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'`.
   Register the scheme as `standard` and `secure`.
3. **Render** (home chat container in `src/renderer/src/pages/home/Page.tsx`): for each active mode
   with a background, render this element as the first child of the chat container, which needs
   `relative isolate`:

   ```tsx
   <iframe
   	src={`kucedr-mode://${mode.plugin}/${mode.id}/index.html`}
   	sandbox="allow-scripts"
   	aria-hidden
   	tabIndex={-1}
   	className="pointer-events-none absolute inset-0 -z-10 size-full border-0 bg-transparent"
   />
   ```

   With `sandbox` set and `allow-same-origin` left out, the frame gets an opaque origin. It has no
   preload API, no storage or cookies, and no access to the parent page.
4. **Lifecycle**: mount the frame when the mode turns on and unmount it when the mode turns off. If
   several modes have backgrounds, they stack in `modeIds` order.

## Messages to the frame

The renderer sends messages to the frame with `postMessage`. The frame never sends anything back:
the host ignores any `message` event coming from it.

| Message                                                     | When                                     |
| ----------------------------------------------------------- | ---------------------------------------- |
| `{ type: 'theme', tokens: Record<string,string>, dark }`    | When the frame loads and the theme changes |
| `{ type: 'motion', reduced: boolean }`                      | When the frame loads and the setting changes |
| `{ type: 'agent', status: 'idle' \| 'thinking' \| 'streaming' \| 'tool' \| 'done' \| 'error' }` | When the run status changes |
| `{ type: 'visible', value: boolean }`                       | When the window is hidden or shown       |

`tokens` holds resolved values of the CSS variables, such as `--primary` and `--background`. The
iframe can't read the app's CSS, so the host sends them. A background should stop its animation
loop when it receives `reduced: true` or `visible: false`.

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
