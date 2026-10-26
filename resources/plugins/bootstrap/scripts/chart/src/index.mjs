// Reads { input, theme } JSON on stdin and prints a self-contained HTML chart.
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
const bundle = fs.readFileSync(new URL('browser.js', import.meta.url), 'utf8');

process.stdout.write(`<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{height:100%;margin:0;background:var(--background,Canvas);color:var(--foreground,CanvasText);color-scheme:${theme === 'dark' ? 'dark' : 'light'};font:13px system-ui,sans-serif}
body{display:flex;flex-direction:column;padding:8px 12px;box-sizing:border-box}
h3{margin:0;font-size:14px;font-weight:600}p{margin:2px 0 0;opacity:.7}
#chart{position:relative;flex:1;min-height:0}
h3 + #chart,p + #chart{margin-top:8px}
#chart :focus-visible{outline:2px solid var(--ring,Highlight);outline-offset:2px}
</style></head><body>
${title ? `<h3>${escape(title)}</h3>` : ''}${input.description ? `<p>${escape(input.description)}</p>` : ''}
<div id="chart"></div>
<script id="chart-input" type="application/json">${data}</script>
<script>${bundle}</script>
</body></html>`);
