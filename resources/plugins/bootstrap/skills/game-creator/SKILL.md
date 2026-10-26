---
name: game-creator
description: Create retro arcade-style browser games (Tetris, Snake, Breakout, shooters, puzzles) as Kucedr apps, with pixel sprites and synthesized sounds, either as a standalone app or as a new game inside the Arcade app. Use when the user asks for a game to play in Kucedr.
---

# Game creator

A game is a Kucedr app: a folder with `manifest.json`, `index.html`, plain `.js` files, and
assets. Give it `"mode": "both"` so it opens inside Kucedr by default (a sandboxed iframe,
`allow-scripts` only, under a strict CSP) and can also open in its own window. Read the
`kucedr-plugin-creator` skill for plugin layout, install, and packaging.

## Pick the shape

- **Standalone app** (like Tetris): `apps/<game-id>/`. It gets its own command menu entry.
  Use this unless the user says otherwise.
- **Arcade game** (like Snake): `apps/arcade/games/<game-id>/` in a plugin that already has
  the Arcade app. Also add `{ id: '<game-id>', title: '<Title>' }` to `GAMES` in
  `arcade.js`. In `index.html`, load `../../bridge.js` before the game script. The bridge sends Esc
  back to the Arcade menu and inserts a coin on load.

## Sandbox rules

- No inline `<script>`, no network, no remote fonts, images or scripts. Every path is relative.
- `localStorage`, `sessionStorage` and IndexedDB throw because the origin is opaque. Keep high
  scores in memory, or wrap storage in `try/catch`.
- No `alert`/`confirm`/`prompt`. Draw messages on the canvas instead.
- Images load from the folder or `data:` URLs, so drawing them onto a canvas works.
- Audio: synthesize it with Web Audio. Don't ship audio files.

## Files

```text
<game-id>/
  manifest.json   title, description, "mode": "both", metadata (version, category "games", entry "index.html", image "icon.svg"), window
  icon.svg        pixel-art icon, tiny viewBox, shape-rendering="crispEdges", shown at 16 px
  sprites.svg     sprite sheet: one row of 8×8 tiles, crispEdges
  index.html      canvas, controls hint, scripts
  sound.js        Web Audio sfx and music
  <game-id>.js    game state, update loop, drawing, input
```

Add more sprite sheets or rows only when the game needs them. Standalone games skip `bridge.js`.

## Look and feel

Match the Arcade style: black background, `ui-monospace, Menlo, monospace`, and colors
`#ff3` (titles, labels), `#3c3` (blinking prompts), `#3cf`, `#e33`, `#c3f`, `#36f`, `#f93`,
plus `#fff` for values. Start on a title screen with a blinking `PRESS ENTER`. Show `PAUSED`
and `GAME OVER · Enter to restart` as overlays. List the controls in one line under the canvas.

## index.html

```html
<!doctype html>
<html>
	<head>
		<meta charset="utf-8" />
		<title>Game</title>
		<style>
			html, body { margin: 0; height: 100%; background: #000; color: #888; font: 13px ui-monospace, Menlo, monospace; overflow: hidden; }
			body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
			canvas { max-width: 100%; max-height: calc(100% - 40px); image-rendering: pixelated; outline: none; }
		</style>
	</head>
	<body>
		<canvas id="board" width="376" height="480" tabindex="0"></canvas>
		<div>← → move · Space action · P pause · M mute</div>
		<script src="sound.js"></script>
		<script src="game.js"></script>
	</body>
</html>
```

Inline styles are allowed. Inline scripts are not.

## Sprites

Build the sheet as an SVG. Each tile has a base fill, a light top-left edge, a dark bottom-right
edge, and a glint:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="8" viewBox="0 0 16 8" shape-rendering="crispEdges">
	<g transform="translate(0 0)"><rect width="8" height="8" fill="#3cf"/><path fill="#fff" fill-opacity=".5" d="M0 0h8v1H1v7H0z"/><path fill="#000" fill-opacity=".4" d="M7 1h1v7H1V7h6z"/><path fill="#fff" fill-opacity=".7" d="M2 2h2v1H3v1H2z"/></g>
	<g transform="translate(8 0)">…next tile…</g>
</svg>
```

For characters and ships, draw pixel paths on the 8×8 grid (`M2 0h1v1H2z…`) instead of the bevel.
Generate repetitive sheets with a short script rather than by hand. Draw tile `i` like this:

```js
const sprites = new Image();
sprites.src = 'sprites.svg';
function tile(i, x, y, size) {
	ctx.drawImage(sprites, i * 8, 0, 8, 8, x, y, size, size);
}
```

Set `ctx.imageSmoothingEnabled = false` at the start of every draw.

## sound.js

```js
const audio = new AudioContext();
const master = audio.createGain();
master.gain.value = 0.15;
master.connect(audio.destination);

function tone(freq, dur, { type = 'square', at = 0, to = freq, vol = 1, out = master } = {}) {
	const t = audio.currentTime + at;
	const osc = audio.createOscillator();
	const gain = audio.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t);
	osc.frequency.exponentialRampToValueAtTime(to, t + dur);
	gain.gain.setValueAtTime(vol, t);
	gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
	osc.connect(gain).connect(out);
	osc.start(t);
	osc.stop(t + dur);
}

const sfx = {
	move: () => tone(220, 0.03),
	shoot: () => tone(880, 0.1, { to: 220 }),
	hit: () => tone(140, 0.08, { type: 'triangle', to: 70 }),
	score: () => [523, 659, 784].forEach((f, i) => tone(f, 0.12, { at: i * 0.06 })),
	over: () => tone(440, 1.2, { type: 'sawtooth', to: 55 }),
};

function toggleMute() {
	master.gain.value = master.gain.value ? 0 : 0.15;
}
```

- Use one short sound per game event, with pitch slides for motion, arpeggios for rewards, and a
  long falling sawtooth for game over.
- For music, loop a melody of `[midi, beats]` pairs into its own gain node, and play notes with
  `tone(440 * 2 ** ((midi - 69) / 12), …)`. Re-schedule with `setTimeout` after the melody length.
  Stop it by disconnecting the gain and clearing the timer. Use only original or public-domain
  tunes.
- Call `audio.resume()` on the first keydown, because autoplay starts suspended.
- On pause, stop the music instead of suspending the context.

## Game script

- Keep all state in top-level `let` variables, set by `reset()`.
- Run one `requestAnimationFrame(frame)` loop. Advance the game on a timer such as
  `t - lastStep > speed()`, then call `draw(t)`. Set `lastStep = performance.now()` in `reset()`.
- Use small named functions: `reset`, `spawn`, `collide`, `move`, `update`, `draw`, `text`,
  `gameOver`.
- Handle input with one `keydown` listener. Normalize the key with
  `e.key.length === 1 ? e.key.toLowerCase() : e.key`. Accept both arrows and WASD. Use Enter to
  start or restart, P to pause, and M to mute. Call `preventDefault()` only for handled keys.
- Raise difficulty with score or level, and show score, level and anything else that matters on
  the canvas.
- Give feedback for every event: a sound, plus a flash or short animation for big moments.

## Verify

1. `node --check` every `.js` file.
2. Copy the folder to a scratch directory. Append a script that dispatches keys
   (`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))`, then moves). Take
   a screenshot with headless Chrome:

   ```sh
   chrome --headless --allow-file-access-from-files --virtual-time-budget=1500 \
     --window-size=420,560 --screenshot=shot.png file:///path/to/copy/index.html
   ```

   Look at the screenshot. Sprites should render, the HUD should update, and nothing should
   overflow.
3. Check the manifest: `title`, `description`, `"mode": "both"`, and `metadata` with an `entry` and an `image` (`icon.svg`) that exist.
4. Tell the user where the game is, its controls, and what you didn't verify. Headless Chrome
   plays no audio.
