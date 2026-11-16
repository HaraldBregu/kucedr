import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readTheme, listThemes } from '../../../../src/main/plugins/themes';
import { scanPlugins } from '../../../../src/main/plugins/plugins_scan';
import { disabledPlugins } from '../../../../src/main/plugins/plugins_disabled';

jest.mock('../../../../src/main/plugins/plugins_scan', () => ({ scanPlugins: jest.fn() }));
jest.mock('../../../../src/main/plugins/plugins_disabled', () => ({ disabledPlugins: jest.fn() }));

const source = { id: 'example', name: 'Example' };
let root: string;
let folder: string;

beforeEach(() => {
	root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-theme-'));
	folder = path.join(root, 'themes', 'sample');
	mkdirSync(folder, { recursive: true });
	writeFileSync(
		path.join(folder, 'manifest.json'),
		JSON.stringify({
			id: 'sample',
			title: 'Sample',
			light: { background: '#fff' },
			dark: { background: '#000' },
		})
	);
	jest.mocked(disabledPlugins).mockReturnValue(new Set());
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
					version: '1',
					contributes: { themes: ['sample'] },
				},
			} as never,
		]);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

it('discovers theme palettes with plugin ownership and disabled status', () => {
	expect(listThemes()).toEqual([
		expect.objectContaining({
			id: 'sample',
			title: 'Sample',
			plugin: expect.objectContaining(source),
			enabled: true,
			dark: { background: '#000' },
		}),
	]);
	jest.mocked(disabledPlugins).mockReturnValue(new Set(['example']));
	expect(listThemes()[0].enabled).toBe(false);
});

it('rejects invalid manifests and skips invalid contributions during discovery', () => {
	writeFileSync(
		path.join(folder, 'manifest.json'),
		JSON.stringify({ id: 'wrong', title: 'Sample', light: {}, dark: {} })
	);
	expect(() => readTheme(folder, source, true)).toThrow();
	const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
	expect(listThemes()).toEqual([]);
	warn.mockRestore();
});

it('rejects CSS injection and missing mode palettes', () => {
	writeFileSync(
		path.join(folder, 'manifest.json'),
		JSON.stringify({
			id: 'sample',
			title: 'Sample',
			light: { background: 'red; color: blue' },
			dark: {},
		})
	);
	expect(() => readTheme(folder, source, true)).toThrow();
	writeFileSync(
		path.join(folder, 'manifest.json'),
		JSON.stringify({ id: 'sample', title: 'Sample', light: {} })
	);
	expect(() => readTheme(folder, source, true)).toThrow();
});
