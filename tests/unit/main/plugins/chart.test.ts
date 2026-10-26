import { buildSync } from 'esbuild';
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
			const data = JSON.parse(html.match(/<script id="chart-input" type="application\/json">(.*?)<\/script>/s)![1]);
			expect(data).toEqual({ ...input, type });
			expect(html).toContain('recharts-wrapper');
			expect(html).toContain('var(--chart-1');
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
	expect(html.match(/<script(?:\s|>)/g)).toHaveLength(2);
	expect(html).toContain('&#60;/script&#62;');
	const data = JSON.parse(html.match(/<script id="chart-input" type="application\/json">(.*?)<\/script>/s)![1]);
	expect(data.data[0].month).toEqual(text);
});
