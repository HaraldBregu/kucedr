import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { importApps } from '../../../../src/main/apps/app_import';
import { listApps } from '../../../../src/main/apps/app_list';
import { readAppManifestFromDirectory } from '../../../../src/main/apps/app_read';

describe('package app window configuration', () => {
	let location: string;
	let source: string;
	const packageJson = {
		name: 'Notes',
		description: 'A notes app',
		version: '1.0.0',
		main: 'index.html',
	};

	beforeEach(() => {
		location = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-package-'));
		source = path.join(location, 'source', 'notes');
		fs.mkdirSync(source, { recursive: true });
		fs.writeFileSync(path.join(source, 'index.html'), '<h1>Notes</h1>');
	});

	afterEach(() => {
		fs.rmSync(location, { recursive: true, force: true });
	});

	it('imports and discovers package-only window settings', () => {
		const window = { width: 480, height: 320, resizable: false, maximizable: false };
		fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({
			...packageJson,
			kucedr: { window },
		}));

		const result = importApps([source], location);
		expect(result.skipped).toEqual([]);
		expect(result.imported[0]).toMatchObject({ id: 'notes', window });
		expect(listApps(location)).toEqual(result.imported);
	});

	it('keeps package-only apps without configuration valid', () => {
		fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify(packageJson));
		expect(readAppManifestFromDirectory(source)).toEqual({
			title: 'Notes',
			description: 'A notes app',
			metadata: { version: '1.0.0', category: 'utility', entry: 'index.html' },
		});
	});

	it.each([
		{ width: 0 },
		{ width: 32769 },
		{ height: 1.5 },
		{ width: 480, minWidth: 620 },
		{ resizable: 'false' },
		null,
		[],
	])('rejects invalid package window settings: %j', (window) => {
		fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({
			...packageJson,
			kucedr: { window },
		}));
		expect(readAppManifestFromDirectory(source)).toBeNull();
		expect(importApps([source], location).imported).toEqual([]);
	});

	it('uses manifest configuration before package configuration', () => {
		fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({
			...packageJson,
			kucedr: { window: { width: 0 } },
		}));
		fs.writeFileSync(path.join(source, 'manifest.json'), JSON.stringify({
			title: 'Notes',
			description: 'A notes app',
			metadata: { version: '1.0.0', category: 'utility', entry: 'index.html' },
			window: { width: 960 },
		}));
		expect(readAppManifestFromDirectory(source)).toMatchObject({ window: { width: 960 } });
	});
});
