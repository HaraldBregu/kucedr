import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
	discoverChannels,
	loadChannels,
	resolveChannel,
} from '../../../../src/main/channels/catalog';
import { readPluginChannel } from '../../../../src/main/channels/channel_manifest';
import { scanPlugins } from '../../../../src/main/plugins/plugins_scan';
import { pluginsStore } from '../../../../src/main/plugins/plugins_store';
import { validatePluginContents } from '../../../../src/main/plugins/plugins_validate_contents';

jest.mock('../../../../src/main/plugins/plugins_scan', () => ({ scanPlugins: jest.fn() }));
jest.mock('../../../../src/main/plugins/plugins_store', () => ({
	pluginsStore: { get: jest.fn() },
}));

const plugin = { id: 'example', name: 'Example' };
let root: string;

function channel(name: string, entry = 'index.cjs') {
	const directory = path.join(root, 'channels', name);
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		path.join(directory, 'manifest.json'),
		JSON.stringify({ id: name, name, entry, credentials: [] })
	);
	writeFileSync(path.join(directory, 'index.cjs'), 'module.exports = {}');
	return directory;
}

beforeEach(() => {
	root = mkdtempSync(path.join(os.tmpdir(), 'channels-'));
	jest.mocked(pluginsStore.get).mockReturnValue([] as never);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('channel manifests', () => {
	it('discovers multiple qualified channels and omits disabled plugins', () => {
		channel('default');
		channel('other');
		jest
			.mocked(scanPlugins)
			.mockReturnValue([
				{
					id: 'example',
					directory: root,
					builtIn: false,
					manifest: {
						id: 'example',
						title: 'Example',
						version: '1.0.0',
						contributes: { channels: ['default', 'other'] },
					},
				} as never,
			]);
		expect(discoverChannels().map((item) => item.id)).toEqual(['example/default', 'example/other']);
		expect(resolveChannel('example/other')?.entry).toBe(
			path.join(root, 'channels', 'other', 'index.cjs')
		);
		expect(loadChannels().map((item) => item.provider.id)).toEqual([
			'example/default',
			'example/other',
		]);
		jest.mocked(pluginsStore.get).mockReturnValue(['example'] as never);
		expect(discoverChannels()).toEqual([]);
	});

	it('rejects invalid manifests and unsafe or missing entries during install validation', () => {
		const directory = channel('default', '../index.cjs');
		expect(() => readPluginChannel(directory, plugin)).toThrow();
		writeFileSync(
			path.join(directory, 'manifest.json'),
			JSON.stringify({ id: 'default', name: 'Default', entry: 'missing.cjs', credentials: [] })
		);
		expect(() => readPluginChannel(directory, plugin)).toThrow('does not exist');
		expect(() =>
			validatePluginContents(root, {
				id: 'example',
				title: 'Example',
				contributes: {
					channels: ['default'],
					apps: [],
					mcp: [],
					scripts: [],
					skills: [],
					providers: [],
				},
			} as never)
		).toThrow('does not exist');
	});
});
