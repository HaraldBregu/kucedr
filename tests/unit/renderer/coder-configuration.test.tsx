import {
	act,
	fireEvent,
	render,
	renderHook,
	screen,
	waitFor,
	within,
} from '@testing-library/react';
import { Authentication } from '../../../src/renderer/src/coder/Authentication';
import { useConfiguration } from '../../../src/renderer/src/coder/hooks/configuration';
import { useProjectInstructions } from '../../../src/renderer/src/coder/hooks/instructions';

const settings: import('../../../src/shared/coding_types').CodingSettings = {
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
	getSession: jest.fn(),
	saveSessionSettings: jest.fn(),
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
	Object.defineProperty(window, 'coder', { configurable: true, value: api });
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

it('configures Cline independently of Pi and Codex and opens account sign-in', async () => {
	api.listModels.mockImplementation(async (runtime) => ({
		providers: [
			{
				id: runtime === 'cline' ? 'cline' : 'openai-codex',
				configured: false,
				models: [],
			},
		],
	}));
	api.setApiKey = jest.fn().mockResolvedValue(undefined);
	api.connectCodex.mockImplementation(async (onEvent) => {
		onEvent({
			type: 'device-code',
			userCode: 'ABCD',
			verificationUri: 'https://example.com/device',
		});
	});
	render(<Authentication onChanged={jest.fn()} />);
	await waitFor(() => expect(screen.getByText('Cline')).toBeInTheDocument());
	const cline = screen.getByText('Cline').closest('.grid')!;
	fireEvent.change(within(cline).getByLabelText('Cline API key'), {
		target: { value: 'cline-key' },
	});
	fireEvent.click(within(cline).getByRole('button', { name: 'Save key' }));
	await waitFor(() => expect(api.setApiKey).toHaveBeenCalledWith('cline', 'cline-key', 'cline'));
	fireEvent.click(within(cline).getByRole('button', { name: 'Connect account' }));
	await waitFor(() => expect(api.connectCodex).toHaveBeenCalledWith(expect.any(Function), 'cline'));
	expect(window.app.openExternalUrl).toHaveBeenCalledWith('https://example.com/device');
});

it('saves instruction content with its loaded revision and preserves drafts on conflicts', async () => {
	api.saveProjectInstructions.mockRejectedValue(new Error('File changed externally'));
	const { result } = renderHook(() => useProjectInstructions('project'));
	await waitFor(() => expect(result.current.loading).toBe(false));
	act(() => result.current.setContent('My draft'));
	await act(async () => result.current.save());
	expect(api.saveProjectInstructions).toHaveBeenCalledWith(
		'project',
		{
			content: 'My draft',
			expectedRevision: 'revision-one',
		},
		undefined
	);
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

it('reloads saved session settings after visiting harness defaults', async () => {
	const session = { projectId: 'project', id: 'session' };
	let confirmed = settings;
	api.getSession.mockImplementation(async () => ({
		session: { ...session, settings: confirmed },
		blocks: [],
	}));
	api.saveSessionSettings.mockImplementation(async (_project, _id, next) => {
		confirmed = next;
		return { ...session, settings: confirmed };
	});
	const { result, rerender } = renderHook(
		({ defaults }) => useConfiguration(settings, session, defaults),
		{ initialProps: { defaults: false } }
	);
	await waitFor(() => expect(result.current.loading).toBe(false));
	act(() => result.current.setModel('saved-model'));
	await waitFor(() => expect(result.current.settings?.modelId).toBe('saved-model'));
	rerender({ defaults: true });
	await waitFor(() => expect(result.current.settings?.modelId).toBe('first'));
	rerender({ defaults: false });
	await waitFor(() => expect(result.current.settings?.modelId).toBe('saved-model'));
	expect(api.saveSettings).not.toHaveBeenCalled();
	expect(result.current.settings?.runtime).toBe('pi');
});

it('does not expose old harness instructions while loading another harness', async () => {
	let resolveCodex!: (value: typeof instructions) => void;
	api.getProjectInstructions.mockImplementation((_project, runtime) =>
		runtime === 'codex'
			? new Promise((resolve) => {
					resolveCodex = resolve;
				})
			: Promise.resolve(instructions)
	);
	const { result, rerender } = renderHook(
		({ runtime }: { runtime: 'pi' | 'codex' }) => useProjectInstructions('project', runtime),
		{ initialProps: { runtime: 'pi' as 'pi' | 'codex' } }
	);
	await waitFor(() => expect(result.current.loading).toBe(false));
	rerender({ runtime: 'codex' });
	expect(result.current.loading).toBe(true);
	expect(result.current.canSave).toBe(false);
	expect(result.current.content).toBe('');
	await act(async () =>
		resolveCodex({ ...instructions, activeFileName: 'AGENTS.md', content: 'Codex instructions' })
	);
	expect(result.current.content).toBe('Codex instructions');
	expect(api.getProjectInstructions).toHaveBeenLastCalledWith('project', 'codex');
});
