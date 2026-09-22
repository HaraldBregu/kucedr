import path from 'node:path';

const root = '/tmp/kucedr-coding-store-test';

jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => root,
}));

import { CodingStore, DEFAULT_CODING_SETTINGS } from '../../../../src/main/coding/store';

it('defaults to Pi, Codex, and read-only tools', () => {
	const store = new CodingStore();

	expect(store.get()).toEqual(DEFAULT_CODING_SETTINGS);
	expect((store as unknown as { store: { path: string } }).store.path).toBe(
		path.join(root, 'coder', 'settings.json')
	);
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
