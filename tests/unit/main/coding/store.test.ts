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

it('keeps defaults independent for each harness including its working directory', () => {
	const store = new CodingStore();
	const pi = store.set({
		...DEFAULT_CODING_SETTINGS,
		modelId: 'pi-model',
		workingDirectory: '/projects/pi',
	});
	const codex = store.set({
		...DEFAULT_CODING_SETTINGS,
		runtime: 'codex',
		modelId: 'codex-model',
		workingDirectory: '/projects/codex',
	});
	const claude = store.set({
		...DEFAULT_CODING_SETTINGS,
		runtime: 'claude',
		providerId: 'anthropic',
		modelId: 'claude-model',
		workingDirectory: '/projects/claude',
	});
	expect(store.get()).toEqual(claude);
	expect(store.get('pi')).toEqual(pi);
	expect(store.get('codex')).toEqual(codex);
	expect(store.get('claude')).toEqual(claude);
	expect(store.get('pi')).not.toHaveProperty('profiles');
	expect(() => store.set({ ...pi, workingDirectory: 'relative/path' })).toThrow('absolute');
});
