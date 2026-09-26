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

it('keeps harness defaults independent including their working directory', () => {
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
	const cline = store.set({
		...DEFAULT_CODING_SETTINGS,
		runtime: 'cline',
		providerId: 'cline',
		modelId: 'cline-model',
		workingDirectory: '/projects/cline',
	});
	expect(store.get()).toEqual(cline);
	expect(store.get('pi')).toEqual(pi);
	expect(store.get('codex')).toEqual(codex);
	expect(store.get('cline')).toEqual(cline);
	expect(store.get('pi')).not.toHaveProperty('profiles');
	expect(() => store.set({ ...pi, workingDirectory: 'relative/path' })).toThrow('absolute');
});

it('keeps the Coder layout when harness settings change', () => {
	const store = new CodingStore();
	const layout = {
		sidebarOpen: false,
		viewerOpen: true,
		sidebarWidth: 320,
		viewerWidth: 480,
	};
	expect(store.getLayout()).toBeNull();
	expect(store.setLayout(layout)).toEqual(layout);
	store.set({ ...DEFAULT_CODING_SETTINGS, modelId: 'model' });
	expect(store.getLayout()).toEqual(layout);
	expect(() => store.setLayout({ ...layout, viewerWidth: Number.NaN })).toThrow(
		'Invalid Coder layout.'
	);
});
