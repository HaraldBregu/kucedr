import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { pluginScripts } from '../../../../src/main/plugins/scripts/plugin_script_list';
import { renderPluginScript } from '../../../../src/main/plugins/scripts/plugin_script_render';
import { runPluginScript } from '../../../../src/main/agent/tools/plugin/run';

const directory = path.resolve('resources/plugins/bootstrap/scripts/draw');
const input = { elements: [{ type: 'rectangle', x: 0, y: 0, label: { text: 'Start' } }] };

beforeAll(() => {
	execFileSync(process.execPath, ['build.mjs'], { cwd: directory });
});

it('discovers draw and runs every documented example through the agent tool', async () => {
	expect(pluginScripts()).toEqual(expect.arrayContaining([
		expect.objectContaining({ name: 'draw', fence: 'draw', height: 420 }),
	]));
	const reference = readFileSync('resources/plugins/bootstrap/skills/run-scripts/references/draw.md', 'utf8');
	const examples = [...reference.matchAll(/```json\n([\s\S]*?)\n```/g)];
	expect(examples).toHaveLength(3);
	for (const example of examples)
		await expect(runPluginScript.run({ name: 'draw', input: JSON.parse(example[1]) })).resolves.toMatchObject({ ok: true });
});

it.each(['light', 'dark'] as const)('generates self-contained HTML within the host limit in %s mode', async (theme) => {
	const html = await renderPluginScript('draw', input, theme);
	expect(Buffer.byteLength(html)).toBeLessThan(2 * 1024 * 1024);
	expect(html).toContain(`color-scheme:${theme}`);
	expect(html).toContain('data:font/woff2;base64,');
	const dom = new JSDOM(html);
	try {
		expect(dom.window.document.querySelectorAll('script[src],link[href]')).toHaveLength(0);
		expect(dom.window.document.querySelector('h3')).toBeNull();
		expect(JSON.parse(dom.window.document.getElementById('draw-input')!.textContent!)).toEqual(input);
	} finally {
		dom.window.close();
	}
});

it.each([
	[null, 'input must be an object'],
	[{ elements: [] }, 'between 1 and 200'],
	[{ elements: [{ type: 'image', x: 0, y: 0 }] }, 'element type'],
	[{ elements: [{ type: 'text', x: 0, y: 0 }] }, 'text string'],
	[{ elements: [{ type: 'line', x: 0, y: 0, points: [[0, 0]] }] }, 'points'],
	[{ elements: [{ type: 'arrow', x: 0, y: 0, end: { id: 'missing' } }] }, 'reference an element id'],
	[{ ...input, title: 42 }, 'title must be a string'],
])('rejects invalid input before emitting HTML: %j', (invalid, message) => {
	const result = spawnSync(process.execPath, [path.join(directory, 'dist/index.mjs')], {
		input: JSON.stringify({ input: invalid, theme: 'light' }), encoding: 'utf8',
	});
	expect(result.status).toBe(1);
	expect(result.stdout).toBe('');
	expect(result.stderr).toContain(message);
});

it('preserves text without allowing inline script or title injection', async () => {
	const text = '</script><script>alert("injected")</script>';
	const html = await renderPluginScript('draw', {
		title: text, description: text,
		elements: [{ type: 'text', x: 0, y: 0, text }],
	}, 'light');
	const dom = new JSDOM(html);
	try {
		expect(dom.window.document.querySelectorAll('script')).toHaveLength(2);
		expect(dom.window.document.querySelector('h3')!.textContent).toBe(text);
		expect(JSON.parse(dom.window.document.getElementById('draw-input')!.textContent!).elements[0].text).toBe(text);
	} finally {
		dom.window.close();
	}
});
