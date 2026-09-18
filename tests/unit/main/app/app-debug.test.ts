import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-debug-user-'));

jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => userData,
}));

import { addDebugApp } from '../../../../src/main/apps/app_debug_add';
import { debugAppsStore } from '../../../../src/main/apps/app_debug_store';
import { deleteApp } from '../../../../src/main/apps/app_delete';
import { listApps } from '../../../../src/main/apps/app_list';
import { appEntryPath } from '../../../../src/main/apps/app_entry';

const manifest = {
	title: 'Debug App',
	description: 'An app loaded directly from its source folder.',
	metadata: {
		version: '1.0.0',
		category: 'debug',
		entry: 'dist/index.html',
		image: 'assets/images/logo.png',
	},
};

function createApp(root: string, name = 'debug-app'): string {
	const directory = path.join(root, name);
	fs.mkdirSync(path.join(directory, 'dist'), { recursive: true });
	fs.mkdirSync(path.join(directory, 'assets/images'), { recursive: true });
	fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
	fs.writeFileSync(path.join(directory, 'dist/index.html'), '<h1>Debug</h1>');
	fs.writeFileSync(path.join(directory, 'assets/images/logo.png'), 'image');
	return directory;
}

describe('debug app folders', () => {
	let root: string;

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-debug-app-'));
		debugAppsStore.set('paths', []);
		fs.rmSync(path.join(userData, 'apps'), { recursive: true, force: true });
	});

	afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
	afterAll(() => fs.rmSync(userData, { recursive: true, force: true }));

	it('registers and discovers an app without copying its folder', () => {
		const directory = createApp(root);
		expect(addDebugApp(directory)).toEqual({ id: 'debug-app', ...manifest, debugPath: directory });
		expect(listApps()).toEqual([
			{
				id: 'debug-app',
				...manifest,
				debugPath: directory,
				imageUrl: expect.stringMatching(
					/^kucedr-app:\/\/debug-app\/assets\/images\/logo\.png\?v=\d+(?:\.\d+)?$/
				),
			},
		]);
		expect(appEntryPath('debug-app', 'dist/index.html')).toBe(
			path.join(directory, 'dist/index.html')
		);
		expect(fs.existsSync(path.join(userData, 'apps', 'debug-app', 'manifest.json'))).toBe(false);
	});

	it('removes only the registration and leaves the source folder intact', () => {
		const directory = createApp(root);
		addDebugApp(directory);
		deleteApp('debug-app');
		expect(fs.existsSync(directory)).toBe(true);
		expect(listApps()).toEqual([]);
	});

	it('rejects relative paths and entry symlinks that escape the app folder', () => {
		expect(() => addDebugApp('relative/app')).toThrow('absolute');
		const directory = createApp(root);
		const outside = path.join(root, 'outside.html');
		fs.writeFileSync(outside, '<h1>Outside</h1>');
		fs.unlinkSync(path.join(directory, 'dist/index.html'));
		fs.symlinkSync(outside, path.join(directory, 'dist/index.html'));
		expect(() => addDebugApp(directory)).toThrow('inside the app folder');
	});
});
