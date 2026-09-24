import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

jest.mock('electron-store', () => {
	const fs = require('node:fs') as typeof import('node:fs');
	const paths = require('node:path') as typeof import('node:path');
	return class {
		readonly path: string;
		private value: Record<string, unknown>;

		constructor(options: { cwd: string; name: string; defaults: Record<string, unknown> }) {
			this.path = paths.join(options.cwd, `${options.name}.json`);
			this.value = fs.existsSync(this.path)
				? JSON.parse(fs.readFileSync(this.path, 'utf8'))
				: { ...options.defaults };
		}

		get store(): Record<string, unknown> {
			return this.value;
		}
		set store(value: Record<string, unknown>) {
			fs.mkdirSync(paths.dirname(this.path), { recursive: true });
			fs.writeFileSync(this.path, JSON.stringify(value));
			this.value = value;
		}
	};
});
jest.mock('../../../../src/main/mcp/mcp_store_state', () => ({
	migrateMcpStoreFromProviders: jest.fn(),
}));
jest.mock('../../../../src/main/tasks/tasks_store', () => ({ taskStorePath: '/tmp/tasks.json' }));
jest.mock('../../../../src/main/providers/providers_index', () => ({}));
jest.mock('../../../../src/main/agent/knowledge/rag/rag_store', () => ({}));
jest.mock('../../../../src/main/storage/providers', () => ({
	storageProviders: { resolve: jest.fn() },
}));

const previousRoot = process.env.KUCEDR_E2E_DATA_ROOT;
let root: string;

beforeEach(() => {
	root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-storage-settings-'));
	process.env.KUCEDR_E2E_DATA_ROOT = root;
});

afterEach(() => {
	if (previousRoot === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
	else process.env.KUCEDR_E2E_DATA_ROOT = previousRoot;
	rmSync(root, { recursive: true, force: true });
});

it('copies existing cloud settings into storage/settings.json and removes the app copy', () => {
	const legacy = {
		providerId: 'a00c674a-c8c8-4d01-930f-ad690b3d0123',
		paths: ['/data/projects'],
		syncEnabled: true,
		syncCronExpression: '0 4 * * *',
	};
	const appFile = path.join(root, 'settings', 'app.json');
	mkdirSync(path.dirname(appFile), { recursive: true });
	writeFileSync(appFile, JSON.stringify({ trayEnabled: false, cloud: legacy }));

	jest.isolateModules(() => {
		const settings =
			require('../../../../src/main/settings_store') as typeof import('../../../../src/main/settings_store');
		expect(settings.getStorageSettings()).toEqual(legacy);
	});

	expect(JSON.parse(readFileSync(path.join(root, 'storage', 'settings.json'), 'utf8'))).toEqual(
		legacy
	);
	expect(JSON.parse(readFileSync(appFile, 'utf8'))).toMatchObject({ trayEnabled: false });
	expect(JSON.parse(readFileSync(appFile, 'utf8'))).not.toHaveProperty('cloud');
});

it('keeps an existing dedicated store authoritative during migration', () => {
	const appFile = path.join(root, 'settings', 'app.json');
	const storageFile = path.join(root, 'storage', 'settings.json');
	mkdirSync(path.dirname(appFile), { recursive: true });
	mkdirSync(path.dirname(storageFile), { recursive: true });
	writeFileSync(
		appFile,
		JSON.stringify({
			cloud: {
				paths: ['/data/old'],
				syncEnabled: false,
				syncCronExpression: '0 3 * * *',
			},
		})
	);
	const selected = {
		paths: ['/data/current'],
		syncEnabled: false,
		syncCronExpression: '0 4 * * *',
	};
	writeFileSync(storageFile, JSON.stringify(selected));

	jest.isolateModules(() => {
		const settings =
			require('../../../../src/main/settings_store') as typeof import('../../../../src/main/settings_store');
		expect(settings.getStorageSettings()).toEqual(selected);
	});

	expect(JSON.parse(readFileSync(storageFile, 'utf8'))).toEqual(selected);
	expect(JSON.parse(readFileSync(appFile, 'utf8'))).not.toHaveProperty('cloud');
});

it('leaves legacy settings untouched when the dedicated file is corrupt', () => {
	const appFile = path.join(root, 'settings', 'app.json');
	const storageFile = path.join(root, 'storage', 'settings.json');
	mkdirSync(path.dirname(appFile), { recursive: true });
	mkdirSync(path.dirname(storageFile), { recursive: true });
	const original = JSON.stringify({
		cloud: {
			paths: ['/data/old'],
			syncEnabled: false,
			syncCronExpression: '0 3 * * *',
		},
	});
	writeFileSync(appFile, original);
	writeFileSync(storageFile, '{broken');

	expect(() => jest.isolateModules(() => require('../../../../src/main/settings_store'))).toThrow();
	expect(readFileSync(appFile, 'utf8')).toBe(original);
	expect(readFileSync(storageFile, 'utf8')).toBe('{broken');
	expect(existsSync(storageFile)).toBe(true);
});
