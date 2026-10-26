// Reads { input, theme } JSON on stdin and prints a self-contained HTML chart.
import fs from 'node:fs';
import { validate } from './validate.mjs';
import { chartConfig } from './config.mjs';

const THEMES = {
	light: { text: '#404040', grid: '#e5e5e5', colors: ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'] },
	dark: { text: '#d4d4d4', grid: '#404040', colors: ['#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee'] },
};

const escape = (value) => String(value).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const { input, theme } = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
try {
	validate(input);
} catch (error) {
	process.stderr.write(error.message);
	process.exit(1);
}
const palette = THEMES[theme] ?? THEMES.light;
const config = JSON.stringify(chartConfig(input, palette)).replace(/</g, '\\u003c');
const chartJs = fs.readFileSync(new URL('browser.js', import.meta.url), 'utf8');

process.stdout.write(`<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{height:100%;margin:0;background:transparent;color:${palette.text};font:13px system-ui,sans-serif}
body{display:flex;flex-direction:column;padding:8px 12px;box-sizing:border-box}
h3{margin:0;font-size:14px;font-weight:600}p{margin:2px 0 0;opacity:.7}
div{position:relative;flex:1;min-height:0;margin-top:8px}
</style></head><body>
<h3>${escape(input.title)}</h3>${input.description ? `<p>${escape(input.description)}</p>` : ''}
<div><canvas></canvas></div>
<script>${chartJs}</script>
<script>new Chart(document.querySelector('canvas'), ${config});</script>
</body></html>`);
