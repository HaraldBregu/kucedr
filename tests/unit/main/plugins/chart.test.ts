import { buildSync } from 'esbuild';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { pluginTools } from '../../../../src/main/plugins/tools/plugin_tool_list';
import { renderPluginTool } from '../../../../src/main/plugins/tools/plugin_tool_render';
import { runPluginTool } from '../../../../src/main/agent/tools/plugin/run';
import { addPluginToolsPrompt } from '../../../../src/main/agent/system/system_add_plugin_tools_prompt';

const input = {
	type: 'bar',
	title: 'Monthly sales',
	xKey: 'month',
	series: [{ key: 'sales', label: 'Sales' }],
	data: [
		{ month: 'Jan', sales: 10 },
		{ month: 'Feb', sales: 20 },
	],
};

beforeAll(() => {
	const absWorkingDir = path.resolve('resources/plugins/bootstrap/tools/chart');
	buildSync({
		absWorkingDir,
		entryPoints: ['src/browser.jsx'],
		jsx: 'automatic',
		bundle: true,
		minify: true,
		format: 'iife',
		outfile: 'dist/browser.js',
	});
	buildSync({
		absWorkingDir,
		entryPoints: ['src/index.mjs'],
		bundle: true,
		platform: 'node',
		format: 'esm',
		outfile: 'dist/index.mjs',
	});
});

it('discovers the bundled chart and tells the agent how to call it', () => {
	const tools = pluginTools();
	expect(tools).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				name: 'chart',
				fence: 'chart',
				plugin: { id: 'bootstrap', name: 'Bootstrap' },
			}),
		])
	);
	const prompt = addPluginToolsPrompt('', tools);
	expect(prompt).toContain('run_plugin_tool');
	expect(prompt).toContain('### chart (Bootstrap plugin)');
	expect(prompt).toContain('"required":["type","title","data","xKey","series"]');
});

it('executes the agent tool and returns success only after generating the HTML', async () => {
	await expect(runPluginTool.run({ name: 'chart', input })).resolves.toEqual({
		ok: true,
		shown: 'Chart displayed to the user.',
	});
	await expect(runPluginTool.run({ name: 'chart', input: { ...input, data: [] } })).rejects.toThrow(
		'data must contain between 1 and 200 rows'
	);
});

it.each(['bar', 'line', 'area', 'pie', 'doughnut'])(
	'generates a standalone %s chart for both themes',
	async (type) => {
		for (const theme of ['light', 'dark'] as const) {
			const html = await renderPluginTool('chart', { ...input, type }, theme);
			expect(html).toContain('<!doctype html>');
			expect(html).toContain('<style>');
			expect(html).toContain('<div id="chart">');
			expect(html).toContain('background:var(--background,Canvas)');
			expect(html).toContain(`color-scheme:${theme}`);
			expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=/i);
			const data = JSON.parse(
				html.match(/<script id="chart-input" type="application\/json">(.*?)<\/script>/s)![1]
			);
			expect(data).toEqual({ ...input, type });
			expect(html).toContain('recharts-wrapper');
			const dom = new JSDOM(html, {
				runScripts: 'dangerously',
				pretendToBeVisual: true,
				beforeParse(window) {
					window.HTMLElement.prototype.getBoundingClientRect = function () {
						const height = this.classList.contains('recharts-legend-wrapper') ? 20 : 240;
						return {
							x: 0,
							y: 0,
							top: 0,
							left: 0,
							right: 800,
							bottom: height,
							width: 800,
							height,
							toJSON: () => ({}),
						};
					};
					window.ResizeObserver = class {
						constructor(private readonly callback: (entries: unknown[]) => void) {}
						observe(target: HTMLElement) {
							this.callback([{ target, contentRect: target.getBoundingClientRect() }]);
						}
						unobserve() {}
						disconnect() {}
					};
				},
			});
			try {
				for (
					let tries = 0;
					tries < 30 && !dom.window.document.querySelector('.recharts-surface');
					tries++
				)
					await new Promise((resolve) => setTimeout(resolve, 20));
				const document = dom.window.document;
				expect(document.querySelector('.recharts-surface')).not.toBeNull();
				const shape =
					type === 'bar'
						? '.recharts-bar-rectangle path'
						: type === 'line'
							? '.recharts-line-curve'
							: type === 'area'
								? '.recharts-area-area'
								: '.recharts-pie-sector path';
				for (let tries = 0; tries < 30 && !document.querySelector(shape); tries++)
					await new Promise((resolve) => setTimeout(resolve, 20));
				expect(document.querySelector(shape)).not.toBeNull();
				expect(
					document.querySelector(shape)!.getAttribute(type === 'line' ? 'stroke' : 'fill')
				).toContain('var(--chart-1');
				const styles = Array.from(document.querySelectorAll('style'))
					.map((style) => style.textContent).join('');
				expect(styles).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ring/);
				if (type === 'line')
					expect(document.querySelector('.recharts-line-dot')?.getAttribute('fill'))
						.toContain('var(--background');
				if (type === 'bar' || type === 'line' || type === 'area') {
					const surface = document.querySelector('svg[role="application"]')!;
					surface.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }));
					surface.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
					for (let tries = 0; tries < 30 && !document.querySelector('.recharts-tooltip-cursor'); tries++)
						await new Promise((resolve) => setTimeout(resolve, 20));
					const cursor = document.querySelector('.recharts-tooltip-cursor');
					expect(cursor).not.toBeNull();
					expect(cursor!.getAttribute(type === 'bar' ? 'fill' : 'stroke'))
						.toContain(type === 'bar' ? 'var(--muted' : 'var(--border');
					if (type !== 'bar')
						expect(document.querySelector('.recharts-active-dot circle')?.getAttribute('stroke'))
							.toContain('var(--background');
				}
			} finally {
				dom.window.close();
			}
		}
	}
);

it.each([
	[{ data: Array.from({ length: 201 }, () => input.data[0]) }, 'between 1 and 200 rows'],
	[{ data: ['invalid'] }, 'every data row needs the xKey field'],
	[{ data: [{ month: null, sales: 10 }] }, 'every data row needs the xKey field'],
	[{ series: [{ key: 'sales' }] }, 'every series needs a non-empty key and label'],
	[{ series: [null] }, 'every series needs a non-empty key and label'],
	[{ series: Array.from({ length: 7 }, () => input.series[0]) }, 'between 1 and 6'],
	[{ data: [{ month: 'Jan', sales: '10' }] }, 'must be a finite number'],
	[{ data: [{ month: 'Jan', sales: Infinity }] }, 'must be a finite number'],
	[{ description: {} }, 'description must be a string'],
])('rejects malformed chart input %j', async (patch, message) => {
	await expect(renderPluginTool('chart', { ...input, ...patch }, 'light')).rejects.toThrow(message);
});

it('escapes markup in text and prevents labels from breaking out of the inline script', async () => {
	const text = '</script><script>alert("injected")</script>';
	const html = await renderPluginTool(
		'chart',
		{
			...input,
			title: text,
			description: text,
			data: [{ month: text, sales: 10 }],
		},
		'light'
	);
	expect(html).not.toContain(text);
	const document = new JSDOM(html).window.document;
	expect(document.querySelectorAll('script')).toHaveLength(2);
	expect(html).toContain('&#60;/script&#62;');
	const data = JSON.parse(
		html.match(/<script id="chart-input" type="application\/json">(.*?)<\/script>/s)![1]
	);
	expect(data.data[0].month).toEqual(text);
});
