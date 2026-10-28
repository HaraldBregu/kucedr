import { buildSync } from 'esbuild';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { pluginScripts } from '../../../../src/main/plugins/scripts/plugin_script_list';
import { renderPluginScript } from '../../../../src/main/plugins/scripts/plugin_script_render';
import { runPluginScript } from '../../../../src/main/agent/tools/plugin/run';
import { createSkillRegistrySnapshot } from '../../../../src/main/agent/skills/skills_registry';
import { readPluginScript } from '../../../../src/main/agent/tools/plugin/read';
import { loadSkillTool } from '../../../../src/main/agent/tools/skills/load_skill';
import { buildLoadedSkillPrompt } from '../../../../src/main/agent/system/system_build_loaded_skill_prompt';
import type { SkillLoadResult } from '../../../../src/shared/skills_types';

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

function chartDom(html: string): JSDOM {
	return new JSDOM(html, {
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
}

beforeAll(() => {
	const absWorkingDir = path.resolve('resources/plugins/bootstrap/scripts/chart');
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

it('discovers the bundled chart without an input schema', () => {
	const scripts = pluginScripts();
	expect(scripts).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				name: 'chart',
				fence: 'chart',
				plugin: { id: 'bootstrap', name: 'Bootstrap' },
			}),
		])
	);
	expect(scripts.find((script) => script.name === 'chart')).not.toHaveProperty('inputSchema');
});

it('loads script guidance on demand and runs the chart reference examples', async () => {
	const snapshot = createSkillRegistrySnapshot({
		userRoot: path.resolve('resources/plugins/bootstrap/skills/run-scripts/missing-user-skills'),
	});
	const loaded: SkillLoadResult[] = [];
	const loader = loadSkillTool(snapshot, (skill) => loaded.push(skill));
	expect(buildLoadedSkillPrompt(loaded)).toBe('');
	await expect(loader!.run({ name: 'run-scripts' })).resolves.toMatchObject({
		activated: true,
		name: 'run-scripts',
		resources: [],
	});
	expect(buildLoadedSkillPrompt(loaded)).toContain('read_plugin_script');
	const reference = await readPluginScript.run({ name: 'chart' });
	const examples = [...reference.matchAll(/```json\n([\s\S]*?)\n```/g)];
	expect(examples.length).toBeGreaterThan(0);
	for (const example of examples) {
		await expect(
			runPluginScript.run({ name: 'chart', input: JSON.parse(example[1]) })
		).resolves.toMatchObject({ ok: true });
	}
});

it('executes the agent tool and returns success only after generating the HTML', async () => {
	await expect(runPluginScript.run({ name: 'chart', input })).resolves.toEqual({
		ok: true,
		shown: 'Chart displayed to the user.',
	});
	await expect(runPluginScript.run({ name: 'chart', input: { ...input, data: [] } })).rejects.toThrow(
		'data must contain between 1 and 200 rows'
	);
});

it.each(['bar', 'line', 'area', 'pie', 'doughnut'])(
	'generates a standalone %s chart for both themes',
	async (type) => {
		for (const theme of ['light', 'dark'] as const) {
			const html = await renderPluginScript('chart', { ...input, type }, theme);
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
			const dom = chartDom(html);
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
					.map((style) => style.textContent)
					.join('');
				expect(styles).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ring/);
				if (type === 'line')
					expect(document.querySelector('.recharts-line-dot')?.getAttribute('fill')).toContain(
						'var(--background'
					);
				if (type === 'bar' || type === 'line' || type === 'area') {
					const surface = document.querySelector('svg[role="application"]')!;
					const wrapper = document.querySelector('.recharts-wrapper')!;
					for (const interaction of ['hover', 'keyboard']) {
						if (interaction === 'hover') {
							wrapper.dispatchEvent(
								new dom.window.MouseEvent('mousemove', {
									bubbles: true,
									clientX: 250,
									clientY: 100,
								})
							);
						} else {
							surface.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }));
							surface.dispatchEvent(
								new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
							);
						}
						for (
							let tries = 0;
							tries < 30 && !document.querySelector('.recharts-tooltip-cursor');
							tries++
						)
							await new Promise((resolve) => setTimeout(resolve, 20));
						const cursor = document.querySelector('.recharts-tooltip-cursor');
						expect(cursor).not.toBeNull();
						expect(cursor!.getAttribute(type === 'bar' ? 'fill' : 'stroke')).toContain(
							type === 'bar' ? 'var(--muted' : 'var(--border'
						);
						if (type !== 'bar')
							expect(
								document.querySelector('.recharts-active-dot circle')?.getAttribute('stroke')
							).toContain('var(--background');
						if (interaction === 'hover') {
							wrapper.dispatchEvent(new dom.window.MouseEvent('mouseout', { bubbles: true }));
							for (
								let tries = 0;
								tries < 30 && document.querySelector('.recharts-tooltip-cursor');
								tries++
							)
								await new Promise((resolve) => setTimeout(resolve, 20));
							expect(document.querySelector('.recharts-tooltip-cursor')).toBeNull();
						}
					}
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
	await expect(renderPluginScript('chart', { ...input, ...patch }, 'light')).rejects.toThrow(message);
});

it('escapes markup in text and prevents labels from breaking out of the inline script', async () => {
	const text = '</script><script>alert("injected")</script>';
	const html = await renderPluginScript(
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

it.each([undefined, '', '   '])('renders an untitled chart when title is %j', async (title) => {
	const untitled = { ...input, title };
	await expect(runPluginScript.run({ name: 'chart', input: untitled })).resolves.toMatchObject({
		ok: true,
	});
	const html = await renderPluginScript('chart', untitled, 'light');
	const dom = new JSDOM(html);
	try {
		expect(dom.window.document.querySelector('h3')).toBeNull();
		const visibleText = Array.from(dom.window.document.body.children)
			.filter((element) => element.tagName !== 'SCRIPT')
			.map((element) => element.textContent)
			.join('')
			.trim();
		expect(visibleText).toBe('');
	} finally {
		dom.window.close();
	}
});

it('keeps an explicitly supplied description without inventing a title', async () => {
	const html = await renderPluginScript(
		'chart',
		{ ...input, title: undefined, description: 'Demo values only.' },
		'light'
	);
	const dom = new JSDOM(html);
	try {
		expect(dom.window.document.querySelector('h3')).toBeNull();
		expect(dom.window.document.querySelector('p')?.textContent).toBe('Demo values only.');
	} finally {
		dom.window.close();
	}
});

it.each([null, 42, {}])('rejects a non-string optional title %j', async (title) => {
	await expect(renderPluginScript('chart', { ...input, title }, 'light')).rejects.toThrow(
		'title must be a string'
	);
});

it.each(['horizontal-bar', 'stacked-bar', 'stacked-area', 'scatter', 'radar'])(
	'renders the %s chart geometry with multiple series in both themes',
	async (type) => {
		const expanded = {
			type,
			xKey: type === 'scatter' ? 'x' : 'month',
			series: [
				{ key: 'sales', label: 'Sales' },
				{ key: 'cost', label: 'Cost' },
			],
			data: [
				{ month: 'Jan', x: 1, sales: 10, cost: 6 },
				{ month: 'Feb', x: 3, sales: 20, cost: 8 },
				{ month: 'Mar', x: 5, sales: 15, cost: 9 },
			],
		};
		const selector = type.endsWith('bar')
			? '.recharts-bar-rectangle path'
			: type === 'stacked-area'
				? '.recharts-area-area'
				: type === 'scatter'
					? '.recharts-scatter-symbol path'
					: '.recharts-radar-polygon path';
		for (const theme of ['light', 'dark'] as const) {
			const html = await renderPluginScript('chart', expanded, theme);
			const dom = chartDom(html);
			try {
				const document = dom.window.document;
				for (let tries = 0; tries < 40 && document.querySelectorAll(selector).length < 2; tries++)
					await new Promise((resolve) => setTimeout(resolve, 20));
				expect(document.querySelector('h3')).toBeNull();
				const shapes = Array.from(document.querySelectorAll(selector));
				expect(shapes.length).toBe(type.endsWith('bar') || type === 'scatter' ? 6 : 2);
				expect(shapes[0].getAttribute('fill') ?? shapes[0].getAttribute('stroke')).toContain(
					'var(--chart-1'
				);
				expect(document.querySelectorAll('.recharts-legend-item')).toHaveLength(2);
				if (type === 'horizontal-bar') {
					const bars = shapes.slice(0, 3).map((shape) => ({
						x: Number(shape.getAttribute('x')),
						y: Number(shape.getAttribute('y')),
						width: Number(shape.getAttribute('width')),
						height: Number(shape.getAttribute('height')),
					}));
					expect(bars[0].width).toBeGreaterThan(bars[0].height);
					expect(bars[1].width).toBeGreaterThan(bars[0].width);
					expect(bars[0].x).toBe(bars[1].x);
					expect(bars[0].y).not.toBe(bars[1].y);
				}
				if (type === 'stacked-bar') {
					const first = shapes[0],
						second = shapes[3];
					expect(first.getAttribute('x')).toBe(second.getAttribute('x'));
					expect(first.getAttribute('width')).toBe(second.getAttribute('width'));
					expect(
						Number(second.getAttribute('y')) + Number(second.getAttribute('height'))
					).toBeCloseTo(Number(first.getAttribute('y')));
				}
				if (type === 'stacked-area') {
					expect(shapes[0].getAttribute('d')).not.toBe(shapes[1].getAttribute('d'));
					expect(document.querySelectorAll('.recharts-area')).toHaveLength(2);
					const firstTop = shapes[0].getAttribute('d')!.match(/^M([-\d.]+),([-\d.]+)/)!;
					const secondBaseline = shapes[1].getAttribute('d')!.match(/([-\d.]+),([-\d.]+)Z$/)!;
					expect(Number(secondBaseline[1])).toBeCloseTo(Number(firstTop[1]));
					expect(Number(secondBaseline[2])).toBeCloseTo(Number(firstTop[2]));
				}
				if (type === 'scatter') {
					const points = Array.from(document.querySelectorAll('.recharts-scatter-symbol path'));
					expect(Number(points[0].getAttribute('cx'))).toBeLessThan(
						Number(points[1].getAttribute('cx'))
					);
					expect(Number(points[0].getAttribute('cy'))).toBeGreaterThan(
						Number(points[1].getAttribute('cy'))
					);
				}
				if (type === 'radar')
					expect(document.querySelectorAll('.recharts-polar-angle-axis-tick')).toHaveLength(3);
			} finally {
				dom.window.close();
			}
		}
	}
);

it.each(['Jan', null, Infinity])(
	'rejects scatter x coordinates that are not finite numbers: %j',
	async (x) => {
		await expect(
			renderPluginScript(
				'chart',
				{ ...input, type: 'scatter', xKey: 'x', data: [{ x, sales: 10 }] },
				'light'
			)
		).rejects.toThrow(/scatter.*finite number|xKey/);
	}
);
