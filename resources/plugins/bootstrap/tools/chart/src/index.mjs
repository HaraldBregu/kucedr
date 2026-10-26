// Reads { input, theme } JSON on stdin and prints a self-contained HTML chart.
import fs from 'node:fs';

const TYPES = ['bar', 'line', 'area', 'pie', 'doughnut'];
const THEMES = {
	light: { text: '#404040', grid: '#e5e5e5', colors: ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'] },
	dark: { text: '#d4d4d4', grid: '#404040', colors: ['#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee'] },
};

function fail(message) {
	process.stderr.write(message);
	process.exit(1);
}

function validate(input) {
	if (!input || typeof input !== 'object') fail('input must be an object.');
	if (!TYPES.includes(input.type)) fail(`type must be one of: ${TYPES.join(', ')}.`);
	if (typeof input.title !== 'string' || !input.title.trim()) fail('title is required.');
	if (!Array.isArray(input.data) || input.data.length === 0) fail('data must be a non-empty array of rows.');
	if (typeof input.xKey !== 'string' || !input.xKey) fail('xKey is required: the field that holds each category or label.');
	if (!input.data.every((row) => row && input.xKey in row))
		fail(`every data row needs the xKey field "${input.xKey}".`);
	if (!Array.isArray(input.series) || input.series.length === 0)
		fail('series must list at least one { key, label }.');
	for (const { key } of input.series)
		if (!input.data.every((row) => typeof row[key] === 'number'))
			fail(`series "${key}" must be a number in every data row.`);
}

function chartConfig({ type, data, xKey, series }, { text, grid, colors }) {
	const labels = data.map((row) => String(row[xKey]));
	const round = type === 'pie' || type === 'doughnut';
	const datasets = round
		? [{ label: series[0].label, data: data.map((row) => row[series[0].key]), backgroundColor: labels.map((_, i) => colors[i % colors.length]), borderWidth: 0 }]
		: series.map(({ key, label }, i) => {
				const color = colors[i % colors.length];
				return {
					label,
					data: data.map((row) => row[key]),
					borderColor: color,
					backgroundColor: type === 'area' ? `${color}4d` : color,
					fill: type === 'area',
					tension: 0.3,
					borderRadius: type === 'bar' ? 4 : 0,
				};
			});
	return {
		type: type === 'area' ? 'line' : type,
		data: { labels, datasets },
		options: {
			animation: false,
			maintainAspectRatio: false,
			color: text,
			plugins: { legend: { labels: { color: text } } },
			scales: round
				? {}
				: {
						x: { ticks: { color: text }, grid: { display: false } },
						y: { ticks: { color: text }, grid: { color: grid } },
					},
		},
	};
}

const escape = (value) => String(value).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const { input, theme } = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
validate(input);
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
