// Reads { input, theme } JSON on stdin and prints a self-contained HTML map.
import fs from 'node:fs';
import { validate } from './validate.mjs';

const escape = (value) => String(value).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const { input, theme } = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
try {
	validate(input);
} catch (error) {
	process.stderr.write(error.message);
	process.exit(1);
}
const data = JSON.stringify(input).replace(/</g, '\\u003c');
const title = input.title?.trim();
const read = (file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8');

process.stdout.write(`<!doctype html>
<html><head><meta charset="utf-8"><style>${read('browser.css')}
html,body{height:100%;margin:0;background:var(--background,Canvas);color:var(--foreground,CanvasText);color-scheme:${theme === 'dark' ? 'dark' : 'light'};font:13px system-ui,sans-serif}
body{display:flex;flex-direction:column;padding:8px 12px;box-sizing:border-box}
h3{margin:0 0 8px;font-size:14px;font-weight:600}
#map{flex:1;min-height:0;border-radius:8px}
</style></head><body>
${title ? `<h3>${escape(title)}</h3>` : ''}
<div id="map" aria-label="${escape(title || 'Map')}"></div>
<script id="maps-input" type="application/json">${data}</script>
<script>${read('browser.js').replace(/<\/script/gi, '<\\/script')}</script>
</body></html>`);
