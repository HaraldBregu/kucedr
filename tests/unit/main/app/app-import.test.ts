import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { importApps } from '../../../../src/main/apps/app_import';
import { listApps } from '../../../../src/main/apps/app_list';

describe('app import', () => {
	let appLocation: string;

	beforeEach(() => {
		appLocation = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-app-import-'));
	});

	afterEach(() => {
		fs.rmSync(appLocation, { recursive: true, force: true });
	});

	it('does not delete an app imported from its installed directory', () => {
		const installed = path.join(appLocation, 'apps', 'project');
		fs.mkdirSync(installed, { recursive: true });
		fs.writeFileSync(path.join(installed, 'index.html'), 'installed');
		fs.writeFileSync(
			path.join(installed, 'manifest.json'),
			JSON.stringify({
				title: 'Project',
				description: 'Project app',
				metadata: { version: '1.0.0', category: 'utility', entry: 'index.html' },
			})
		);

		expect(importApps([installed], appLocation)).toMatchObject({
			imported: [],
			skipped: [{ sourcePath: installed, reason: 'Source folder is already installed.' }],
		});
		expect(fs.readFileSync(path.join(installed, 'index.html'), 'utf8')).toBe('installed');
	});

	it('imports the coder app identifier', () => {
		const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-app-source-'));
		const source = path.join(sourceRoot, 'coder');
		fs.mkdirSync(source, { recursive: true });
		fs.writeFileSync(path.join(source, 'index.html'), '<h1>Coder</h1>');
		fs.writeFileSync(
			path.join(source, 'manifest.json'),
			JSON.stringify({
				title: 'Coder',
				description: 'A coding app',
				metadata: { version: '1.0.0', category: 'utility', entry: 'index.html' },
			})
		);

		try {
			expect(importApps([source], appLocation)).toMatchObject({
				imported: [expect.objectContaining({ id: 'coder' })],
				skipped: [],
			});
		} finally {
			fs.rmSync(sourceRoot, { recursive: true, force: true });
		}
	});

	it('does not copy node modules into an imported app', () => {
		const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-app-source-'));
		const source = path.join(sourceRoot, 'project');
		fs.mkdirSync(path.join(source, 'node_modules', 'unused-package'), { recursive: true });
		fs.writeFileSync(path.join(source, 'index.html'), '<h1>Project</h1>');
		fs.writeFileSync(path.join(source, 'node_modules', 'unused-package', 'index.js'), 'unused');
		fs.writeFileSync(
			path.join(source, 'manifest.json'),
			JSON.stringify({
				title: 'Project',
				description: 'Project app',
				metadata: { version: '1.0.0', category: 'utility', entry: 'index.html' },
			})
		);

		try {
			expect(importApps([source], appLocation).imported).toHaveLength(1);
			expect(fs.existsSync(path.join(appLocation, 'apps', 'project', 'node_modules'))).toBe(false);
		} finally {
			fs.rmSync(sourceRoot, { recursive: true, force: true });
		}
	});

	it('imports and discovers the workspace app with its built entry', () => {
		const source = path.join(appLocation, 'resources', 'apps', 'workspace');
		const manifest = JSON.parse(
			fs.readFileSync(path.resolve('resources/apps/workspace/manifest.json'), 'utf8')
		);
		fs.mkdirSync(path.join(source, 'dist'), { recursive: true });
		fs.writeFileSync(path.join(source, 'manifest.json'), JSON.stringify(manifest));
		fs.writeFileSync(path.join(source, manifest.metadata.entry), '<h1>Workspace</h1>');

		expect(importApps([source], appLocation)).toEqual({
			imported: [{ id: 'workspace', ...manifest }],
			skipped: [],
		});
		expect(listApps(appLocation)).toEqual([{ id: 'workspace', ...manifest }]);
		expect(
			fs.readFileSync(path.join(appLocation, 'apps', 'workspace', manifest.metadata.entry), 'utf8')
		).toBe('<h1>Workspace</h1>');
	});

	it('replaces an installed app through a staged copy', () => {
		const installed = path.join(appLocation, 'apps', 'project');
		const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-app-source-'));
		const source = path.join(sourceRoot, 'project');
		fs.mkdirSync(installed, { recursive: true });
		fs.mkdirSync(source, { recursive: true });
		fs.writeFileSync(path.join(installed, 'old.txt'), 'old');
		fs.mkdirSync(path.join(installed, 'data'), { recursive: true });
		fs.writeFileSync(path.join(installed, 'data', 'store.json'), '{"saved":true}');
		fs.writeFileSync(path.join(source, 'index.html'), 'replacement');
		fs.mkdirSync(path.join(source, 'data'), { recursive: true });
		fs.writeFileSync(path.join(source, 'data', 'store.json'), '{"untrusted":true}');
		fs.writeFileSync(
			path.join(source, 'manifest.json'),
			JSON.stringify({
				title: 'Project',
				description: 'Project app',
				metadata: { version: '2.0.0', category: 'utility', entry: 'index.html' },
			})
		);

		try {
			expect(importApps([source], appLocation).imported).toHaveLength(1);
			expect(fs.readFileSync(path.join(installed, 'index.html'), 'utf8')).toBe('replacement');
			expect(fs.existsSync(path.join(installed, 'old.txt'))).toBe(false);
			expect(fs.readFileSync(path.join(installed, 'data', 'store.json'), 'utf8')).toBe(
				'{"saved":true}'
			);
			expect(fs.readdirSync(path.join(appLocation, 'apps'))).toEqual(['project']);
		} finally {
			fs.rmSync(sourceRoot, { recursive: true, force: true });
		}
	});
});
