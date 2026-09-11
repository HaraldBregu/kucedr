import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeAppWindowSettings } from '../../../../src/main/apps/app_write';
import { APP_WINDOW_DEFAULTS } from '../../../../src/shared/app_window_settings';
import { isAppWindowSettings } from '../../../../src/shared/app_window_validate';
import { resolveAppWindowSettings } from '../../../../src/shared/app_window_resolve';

describe('app window configuration', () => {
	it.each([
		undefined,
		null,
		[],
		'large',
		{ width: 0 },
		{ height: -1 },
		{ minWidth: 0.5 },
		{ minHeight: NaN },
		{ width: Infinity },
		{ height: 32769 },
		{ width: 480, minWidth: 481 },
		{ height: 320, minHeight: 321 },
		{ resizable: 'false' },
		{ maximizable: 1 },
		{ webPreferences: { nodeIntegration: true } },
		{ frame: true },
	])('rejects malformed or unsafe settings: %j', (settings) => {
		expect(isAppWindowSettings(settings)).toBe(false);
	});

	it('accepts partial settings and boundary dimensions', () => {
		expect(isAppWindowSettings({})).toBe(true);
		expect(
			isAppWindowSettings({ width: 1, height: 32768, resizable: false, maximizable: false })
		).toBe(true);
		expect(isAppWindowSettings({ width: 480, minWidth: 480 })).toBe(true);
	});

	it('keeps existing defaults and fits omitted minimums to compact windows', () => {
		expect(resolveAppWindowSettings()).toEqual(APP_WINDOW_DEFAULTS);
		expect(resolveAppWindowSettings({ width: 480, height: 320 })).toEqual({
			...APP_WINDOW_DEFAULTS,
			width: 480,
			height: 320,
			minWidth: 480,
			minHeight: 320,
		});
		expect(resolveAppWindowSettings({ minWidth: 1200, minHeight: 900 })).toMatchObject({
			width: 1200,
			height: 900,
			minWidth: 1200,
			minHeight: 900,
		});
	});

	it('applies layered fields without conflicting dimensions', () => {
		expect(
			resolveAppWindowSettings(
				{ width: 1200, height: 900, minWidth: 800, resizable: false },
				{ width: 480, maximizable: false }
			)
		).toEqual({
			width: 480,
			height: 900,
			minWidth: 480,
			minHeight: 480,
			resizable: false,
			maximizable: false,
		});
		expect(() => resolveAppWindowSettings({ width: 100, minWidth: 200 })).toThrow(
			'Invalid app window settings'
		);
	});
});

describe('app manifest window settings', () => {
	let location: string;
	const manifest = {
		title: 'Notes',
		description: 'A notes app',
		metadata: { version: '1.0.0', category: 'utility', entry: 'index.html' },
		window: { width: 960, height: 720 },
	};

	beforeEach(() => {
		location = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-preferences-'));
		fs.mkdirSync(path.join(location, 'apps', 'notes'), { recursive: true });
		fs.writeFileSync(
			path.join(location, 'apps', 'notes', 'manifest.json'),
			JSON.stringify(manifest)
		);
	});

	afterEach(() => {
		fs.rmSync(location, { recursive: true, force: true });
	});

	it('writes settings to the app manifest', () => {
		const saved = writeAppWindowSettings(
			'notes',
			{ width: 480, height: 320, resizable: false },
			location
		);
		expect(saved).toMatchObject({
			width: 480,
			height: 320,
			minWidth: 480,
			minHeight: 320,
			resizable: false,
		});
		const stored = JSON.parse(
			fs.readFileSync(path.join(location, 'apps', 'notes', 'manifest.json'), 'utf8')
		);
		expect(stored.window).toEqual({ width: 480, height: 320, resizable: false });
	});

	it('removes window settings when reset', () => {
		writeAppWindowSettings('notes', {}, location);
		const stored = JSON.parse(
			fs.readFileSync(path.join(location, 'apps', 'notes', 'manifest.json'), 'utf8')
		);
		expect(stored.window).toBeUndefined();
	});

	it('creates a manifest when a package-only app is saved', () => {
		const directory = path.join(location, 'apps', 'package-notes');
		fs.mkdirSync(directory, { recursive: true });
		fs.writeFileSync(
			path.join(directory, 'package.json'),
			JSON.stringify({
				name: 'Package Notes',
				version: '1.0.0',
				description: 'A package-only app',
				main: 'index.html',
				keywords: ['utility'],
			})
		);

		writeAppWindowSettings('package-notes', { width: 800 }, location);

		const stored = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
		expect(stored).toMatchObject({
			title: 'Package Notes',
			metadata: { entry: 'index.html' },
			window: { width: 800 },
		});
	});

	it('rejects invalid updates without replacing the manifest', () => {
		expect(() => writeAppWindowSettings('notes', { width: 400, minWidth: 500 }, location)).toThrow(
			'Invalid app window settings'
		);
		expect(() => writeAppWindowSettings('../outside', {}, location)).toThrow('Invalid app id');
		const stored = JSON.parse(
			fs.readFileSync(path.join(location, 'apps', 'notes', 'manifest.json'), 'utf8')
		);
		expect(stored).toEqual(manifest);
	});
});
