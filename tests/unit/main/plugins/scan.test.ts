import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanPlugins, refreshPlugins } from '../../../../src/main/plugins/plugins_scan';
import { pluginTools } from '../../../../src/main/plugins/tools/plugin_tool_list';

let mockBundledRoot: string;
let mockInstalledRoot: string;
let root: string;

jest.mock('../../../../src/main/plugins/plugins_bundled_root', () => ({
	bundledPluginsRoot: () => mockBundledRoot,
}));
jest.mock('../../../../src/main/plugins/plugins_root', () => ({
	pluginsRoot: () => mockInstalledRoot,
}));
jest.mock('../../../../src/main/plugins/plugins_store', () => ({
	pluginsStore: { get: () => [] },
}));

beforeEach(() => {
	root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-chart-discovery-'));
	mockBundledRoot = path.join(root, 'bundled');
	mockInstalledRoot = path.join(root, 'installed');
	for (const [directory, version] of [
		[mockBundledRoot, '1.1.0'],
		[mockInstalledRoot, '1.0.1'],
	]) {
		mkdirSync(path.join(directory, 'bootstrap', 'skills', 'example'), { recursive: true });
		writeFileSync(
			path.join(directory, 'bootstrap', 'manifest.json'),
			JSON.stringify({
				schemaVersion: 5,
				id: 'bootstrap',
				title: 'Bootstrap',
				version,
				description: 'Bundled capabilities',
				author: 'Kucedr',
			})
		);
	}
	const chart = path.join(mockBundledRoot, 'bootstrap', 'tools', 'chart');
	mkdirSync(chart, { recursive: true });
	writeFileSync(
		path.join(chart, 'manifest.json'),
		JSON.stringify({
			title: 'Chart',
			description: 'Render a chart',
			metadata: { version: '1.0.0', category: 'data', entry: 'index.mjs' },
			inputSchema: { type: 'object' },
		})
	);
	writeFileSync(path.join(chart, 'index.mjs'), '');
	writeFileSync(path.join(chart, 'INSTRUCTIONS.md'), 'Render a chart.');
	refreshPlugins();
});

afterEach(() => {
	refreshPlugins();
	rmSync(root, { recursive: true, force: true });
});

it('keeps bundled chart tools available when an older Bootstrap is installed', () => {
	expect(scanPlugins()[0]).toMatchObject({ builtIn: true, manifest: { version: '1.1.0' } });
	expect(pluginTools().map((tool) => tool.name)).toContain('chart');
});

it.each(['1.1.0', '1.2.0'])('preserves installed overrides at version %s', (version) => {
	const manifest = path.join(mockInstalledRoot, 'bootstrap', 'manifest.json');
	writeFileSync(
		manifest,
		JSON.stringify({ ...JSON.parse(readFileSync(manifest, 'utf8')), version })
	);
	expect(scanPlugins()[0]).toMatchObject({ builtIn: false, manifest: { version } });
});
