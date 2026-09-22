import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-store-'));

jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => root,
}));

import { CodingStore, DEFAULT_CODING_SETTINGS } from '../../../../src/main/coding/store';

beforeEach(() => rmSync(root, { recursive: true, force: true }));

afterAll(() => rmSync(root, { recursive: true, force: true }));

it('defaults to Pi, Codex, and read-only tools', () => {
	const store = new CodingStore();

	expect(store.get()).toEqual(DEFAULT_CODING_SETTINGS);
	store.set(DEFAULT_CODING_SETTINGS);
	expect(existsSync(path.join(root, 'coder', 'coder.json'))).toBe(true);
	expect(existsSync(path.join(root, 'settings', 'coder.json'))).toBe(false);
});

it('persists valid runtime settings without project state', () => {
	const store = new CodingStore();
	const saved = store.set({
		...DEFAULT_CODING_SETTINGS,
		providerId: 'anthropic',
		modelId: 'claude',
		toolMode: 'coding',
	});

	expect(store.get()).toEqual(saved);
	expect(store.get()).not.toHaveProperty('workingDirectory');
});
