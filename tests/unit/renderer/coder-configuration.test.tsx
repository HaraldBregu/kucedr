import { act, renderHook, waitFor } from '@testing-library/react';
import { useConfiguration } from '../../../src/renderer/src/coder/hooks/configuration';
import { useProjectInstructions } from '../../../src/renderer/src/coder/hooks/instructions';

const settings = {
	runtime: 'pi',
	providerId: 'openai-codex',
	modelId: 'first',
	thinkingLevel: 'medium',
	toolMode: 'read-only',
};
const instructions = {
	projectId: 'project',
	activeFilePath: '/project/AGENTS.md',
	activeFileName: 'AGENTS.md',
	content: 'Original',
	exists: true,
	editable: true,
	revision: 'revision-one',
	loadedSources: [],
};
const api = {
	getSettings: jest.fn(),
	saveSettings: jest.fn(),
	listModels: jest.fn(),
	connectCodex: jest.fn(),
	getProjectInstructions: jest.fn(),
	saveProjectInstructions: jest.fn(),
};

beforeEach(() => {
	jest.resetAllMocks();
	api.getSettings.mockResolvedValue(settings);
	api.listModels.mockResolvedValue({ providers: [] });
	api.getProjectInstructions.mockResolvedValue(instructions);
	Object.defineProperty(window, 'coding', { configurable: true, value: api });
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: { openExternalUrl: jest.fn().mockResolvedValue(undefined) },
	});
});

it('retains confirmed settings when IPC rejects a save', async () => {
	api.saveSettings.mockRejectedValue(new Error('Disk full'));
	const { result } = renderHook(() => useConfiguration());
	await waitFor(() => expect(result.current.loading).toBe(false));
	act(() => result.current.setModel('second'));
	await waitFor(() => expect(result.current.error).toBe('Disk full'));
	expect(api.saveSettings).toHaveBeenCalledWith({ ...settings, modelId: 'second' });
	expect(result.current.settings?.modelId).toBe('first');
});

it('chooses the new provider model and accepts the persisted IPC settings', async () => {
	api.listModels.mockResolvedValue({
		providers: [{ id: 'anthropic', models: [{ id: 'claude' }] }],
	});
	api.saveSettings.mockImplementation(async (value) => value);
	const { result } = renderHook(() => useConfiguration());
	await waitFor(() => expect(result.current.loading).toBe(false));
	act(() => result.current.setProvider('anthropic'));
	await waitFor(() => expect(result.current.settings?.providerId).toBe('anthropic'));
	expect(result.current.settings?.modelId).toBe('claude');
});

it('opens device authentication through the native app IPC and refreshes the catalog', async () => {
	api.connectCodex.mockImplementation(async (onEvent) => {
		onEvent({
			type: 'device-code',
			userCode: 'ABCD',
			verificationUri: 'https://example.com/device',
		});
	});
	const { result } = renderHook(() => useConfiguration());
	await waitFor(() => expect(result.current.loading).toBe(false));
	await act(async () => result.current.connect());
	expect(window.app.openExternalUrl).toHaveBeenCalledWith('https://example.com/device');
	expect(api.listModels).toHaveBeenCalledTimes(2);
	expect(result.current.authEvent).toBeNull();
});

it('saves instruction content with its loaded revision and preserves drafts on conflicts', async () => {
	api.saveProjectInstructions.mockRejectedValue(new Error('File changed externally'));
	const { result } = renderHook(() => useProjectInstructions('project'));
	await waitFor(() => expect(result.current.loading).toBe(false));
	act(() => result.current.setContent('My draft'));
	await act(async () => result.current.save());
	expect(api.saveProjectInstructions).toHaveBeenCalledWith('project', {
		content: 'My draft',
		expectedRevision: 'revision-one',
	});
	expect(result.current.error).toBe('File changed externally');
	expect(result.current.content).toBe('My draft');
	expect(result.current.dirty).toBe(true);
});

it('ignores an old project load after switching projects', async () => {
	let resolveOld!: (value: typeof instructions) => void;
	api.getProjectInstructions.mockImplementation((projectId) =>
		projectId === 'old'
			? new Promise((resolve) => {
					resolveOld = resolve;
				})
			: Promise.resolve({ ...instructions, projectId: 'new', content: 'New project' })
	);
	const { result, rerender } = renderHook(({ projectId }) => useProjectInstructions(projectId), {
		initialProps: { projectId: 'old' },
	});
	rerender({ projectId: 'new' });
	await waitFor(() => expect(result.current.content).toBe('New project'));
	await act(async () => resolveOld({ ...instructions, projectId: 'old' }));
	expect(result.current.content).toBe('New project');
});
