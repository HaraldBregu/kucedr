import { CodingStore, DEFAULT_CODING_SETTINGS } from '../../../../src/main/coding/store';

it('defaults to Pi, Codex, and read-only tools', () => {
	const store = new CodingStore('/tmp/kucedr-coding-store-test');

	expect(store.get()).toEqual(DEFAULT_CODING_SETTINGS);
});

it('persists valid runtime settings without project state', () => {
	const store = new CodingStore('/tmp/kucedr-coding-store-test');
	const saved = store.set({
		...DEFAULT_CODING_SETTINGS,
		providerId: 'anthropic',
		modelId: 'claude',
		toolMode: 'coding',
	});

	expect(store.get()).toEqual(saved);
	expect(store.get()).not.toHaveProperty('workingDirectory');
});
