import { act, renderHook, waitFor } from '@testing-library/react';
import { app, coding as codingApi } from '@kucedr/sdk';
import { useCodingWorkspace } from '../../../resources/apps/coding/src/hooks/workspace';
import { useConfiguration } from '../../../resources/apps/coding/src/hooks/configuration';
import { useProjectInstructions } from '../../../resources/apps/coding/src/hooks/instructions';
import { canLeaveInstructions } from '../../../resources/apps/coding/src/navigation';

jest.mock(
	'@kucedr/sdk',
	() => ({
		isKucedr: () => true,
		app: {
			openExternalUrl: jest.fn(),
			getAppStoreValue: jest.fn(),
			setAppStoreValue: jest.fn(),
			deleteAppStoreValue: jest.fn(),
		},
		coding: {
			getSettings: jest.fn(),
			saveSettings: jest.fn(),
			listModels: jest.fn(),
			listProjects: jest.fn(),
			listSessions: jest.fn(),
			getSession: jest.fn(),
			send: jest.fn(),
			cancel: jest.fn(),
			addProject: jest.fn(),
			openProject: jest.fn(),
			removeProject: jest.fn(),
			getProjectInstructions: jest.fn(),
			saveProjectInstructions: jest.fn(),
			connectCodex: jest.fn(),
			cancelCodexLogin: jest.fn(),
			disconnectCodex: jest.fn(),
		},
	}),
	{ virtual: true }
);

const project = {
	id: 'project-1',
	name: 'kucedr',
	directory: '/workspace/kucedr',
	kind: 'agent-workspace' as const,
	createdAt: '2026-08-20T10:00:00.000Z',
	lastOpenedAt: '2026-08-20T10:00:00.000Z',
	available: true,
};

const otherProject = {
	...project,
	id: 'project-2',
	name: 'website',
	directory: '/workspace/website',
	kind: 'external' as const,
};

const session = {
	id: 'session-1',
	projectId: project.id,
	title: 'Existing session',
	createdAt: '2026-08-20T10:00:00.000Z',
	updatedAt: '2026-08-20T10:01:00.000Z',
	messageCount: 2,
};

const otherSession = {
	...session,
	id: 'session-2',
	projectId: otherProject.id,
	title: 'Website session',
};

const projectInstructions = {
	projectId: project.id,
	activeFilePath: '/workspace/kucedr/AGENTS.md',
	activeFileName: 'AGENTS.md',
	content: '# Initial',
	exists: true,
	editable: true,
	revision: 'revision-1',
	loadedSources: [
		{ path: '/global/AGENTS.md', scope: 'coding-global' as const },
		{ path: '/workspace/kucedr/AGENTS.md', scope: 'workspace' as const },
	],
};

beforeEach(() => {
	jest.clearAllMocks();
	(app.getAppStoreValue as jest.Mock).mockResolvedValue(project.id);
	(app.setAppStoreValue as jest.Mock).mockResolvedValue(undefined);
	(codingApi.getSettings as jest.Mock).mockResolvedValue({
		runtime: 'pi',
		providerId: 'openai-codex',
		modelId: 'gpt-coding',
		thinkingLevel: 'medium',
		toolMode: 'coding',
	});
	(codingApi.saveSettings as jest.Mock).mockImplementation(async (settings) => settings);
	(codingApi.listModels as jest.Mock).mockResolvedValue({
		providers: [
			{
				id: 'openai-codex',
				name: 'OpenAI Codex',
				authentication: 'oauth',
				configured: false,
				models: [{ id: 'gpt-coding', name: 'GPT Coder', reasoning: true, contextWindow: 200000 }],
			},
		],
	});
	(codingApi.connectCodex as jest.Mock).mockResolvedValue({ configured: true, type: 'oauth' });
	(codingApi.cancelCodexLogin as jest.Mock).mockResolvedValue(true);
	(codingApi.disconnectCodex as jest.Mock).mockResolvedValue(undefined);
	(codingApi.listProjects as jest.Mock).mockResolvedValue([project]);
	(codingApi.listSessions as jest.Mock).mockResolvedValue([session]);
	(codingApi.getSession as jest.Mock).mockResolvedValue({
		session,
		blocks: [
			{
				id: 'message-1',
				type: 'message',
				role: 'assistant',
				content: 'Restored response',
				timestamp: '2026-08-20T10:01:00.000Z',
			},
		],
	});
	(codingApi.getProjectInstructions as jest.Mock).mockResolvedValue(projectInstructions);
	(codingApi.saveProjectInstructions as jest.Mock).mockImplementation(
		async (_projectId, update) => ({
			...projectInstructions,
			content: update.content,
			exists: true,
			revision: 'revision-2',
		})
	);
});

it('restores the active project session and starts a new persistent Agent run', async () => {
	const { result } = renderHook(() => useCodingWorkspace());

	await waitFor(() => expect(result.current.loading).toBe(false));
	expect(result.current.activeProjectId).toBe(project.id);
	expect(result.current.activeSessionId).toBe(session.id);
	expect(result.current.blocks).toEqual([
		expect.objectContaining({ content: 'Restored response', status: 'complete' }),
	]);

	act(() => {
		result.current.newSession();
		result.current.setInput('Inspect the project');
	});
	(codingApi.send as jest.Mock).mockImplementation(async (request, onEvent) => {
		onEvent({
			type: 'status',
			runId: 'run-1',
			projectId: project.id,
			sessionId: 'session-2',
			status: 'started',
		});
		onEvent({
			type: 'text-delta',
			runId: 'run-1',
			projectId: project.id,
			sessionId: 'session-2',
			delta: 'Done',
		});
		onEvent({
			type: 'status',
			runId: 'run-1',
			projectId: project.id,
			sessionId: 'session-2',
			status: 'completed',
		});
		return { projectId: request.projectId, sessionId: 'session-2', output: 'Done' };
	});

	await act(async () => result.current.send());

	expect(codingApi.send).toHaveBeenCalledWith(
		{ projectId: project.id, mode: 'agent', input: 'Inspect the project' },
		expect.any(Function)
	);
	expect(result.current.activeSessionId).toBe('session-2');
	expect(result.current.blocks).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ role: 'user', content: 'Inspect the project' }),
			expect.objectContaining({ role: 'assistant', content: 'Done', status: 'complete' }),
		])
	);
});

it('groups sessions by workspace and opens an inactive workspace session', async () => {
	(codingApi.listProjects as jest.Mock).mockResolvedValue([project, otherProject]);
	(codingApi.listSessions as jest.Mock).mockImplementation(async (projectId) =>
		projectId === otherProject.id ? [otherSession] : [session]
	);
	(codingApi.getSession as jest.Mock).mockImplementation(async (projectId, sessionId) => ({
		session: projectId === otherProject.id ? otherSession : session,
		blocks: [
			{
				id: sessionId,
				type: 'message',
				role: 'assistant',
				content: projectId === otherProject.id ? 'Website response' : 'Restored response',
				timestamp: '2026-08-20T10:01:00.000Z',
			},
		],
	}));
	const { result } = renderHook(() => useCodingWorkspace());

	await waitFor(() => expect(result.current.loading).toBe(false));
	expect(result.current.sessionsByProject).toEqual({
		[project.id]: [session],
		[otherProject.id]: [otherSession],
	});

	await act(async () => result.current.selectSession(otherProject.id, otherSession.id));
	expect(result.current.activeProjectId).toBe(otherProject.id);
	expect(result.current.activeSessionId).toBe(otherSession.id);
	expect(result.current.blocks).toEqual([expect.objectContaining({ content: 'Website response' })]);
});

it('loads and saves the app configuration through the Coder SDK', async () => {
	const { result } = renderHook(() => useConfiguration());

	await waitFor(() => expect(result.current.loading).toBe(false));
	expect(result.current.selectedProvider?.name).toBe('OpenAI Codex');

	act(() => result.current.setTools('read-only'));
	await waitFor(() =>
		expect(codingApi.saveSettings).toHaveBeenCalledWith(
			expect.objectContaining({ toolMode: 'read-only' })
		)
	);
});

it('projects Codex device authentication into the app configuration', async () => {
	(codingApi.connectCodex as jest.Mock).mockImplementation(async (onEvent) => {
		onEvent({
			type: 'device-code',
			userCode: 'ABCD-EFGH',
			verificationUri: 'https://example.com/device',
		});
		return { configured: true, type: 'oauth' };
	});
	const { result } = renderHook(() => useConfiguration());
	await waitFor(() => expect(result.current.loading).toBe(false));

	await act(async () => result.current.connect());
	expect(result.current.authEvent).toEqual(
		expect.objectContaining({ type: 'device-code', userCode: 'ABCD-EFGH' })
	);
	expect(app.openExternalUrl).toHaveBeenCalledWith('https://example.com/device');
});

it('loads and explicitly saves active workspace instructions with their revision', async () => {
	const { result } = renderHook(() => useProjectInstructions(project.id));

	await waitFor(() => expect(result.current.loading).toBe(false));
	expect(result.current.instructions).toEqual(projectInstructions);
	expect(result.current.content).toBe('# Initial');

	act(() => result.current.setContent('  # Updated\n'));
	expect(result.current.dirty).toBe(true);
	expect(result.current.canSave).toBe(true);
	await act(async () => result.current.save());

	expect(codingApi.saveProjectInstructions).toHaveBeenCalledWith(project.id, {
		content: '  # Updated\n',
		expectedRevision: 'revision-1',
	});
	expect(result.current.content).toBe('  # Updated\n');
	expect(result.current.dirty).toBe(false);
});

it('allows explicit empty-file creation and preserves dirty content after a save conflict', async () => {
	(codingApi.getProjectInstructions as jest.Mock).mockResolvedValue({
		...projectInstructions,
		content: '',
		exists: false,
		revision: 'missing-revision',
	});
	const { result } = renderHook(() => useProjectInstructions(project.id));

	await waitFor(() => expect(result.current.loading).toBe(false));
	expect(result.current.dirty).toBe(false);
	expect(result.current.canSave).toBe(true);
	await act(async () => result.current.save());
	expect(codingApi.saveProjectInstructions).toHaveBeenCalledWith(project.id, {
		content: '',
		expectedRevision: 'missing-revision',
	});

	act(() => result.current.setContent('# Local edit'));
	(codingApi.saveProjectInstructions as jest.Mock).mockRejectedValueOnce(
		new Error('Coder project instructions changed outside Kucedr. Reload before saving.')
	);
	await act(async () => result.current.save());
	expect(result.current.content).toBe('# Local edit');
	expect(result.current.dirty).toBe(true);
	expect(result.current.error).toContain('changed outside Kucedr');
});

it('guards navigation away from dirty instructions', () => {
	const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);

	expect(canLeaveInstructions('instructions', true)).toBe(false);
	expect(confirm).toHaveBeenCalledWith('Discard unsaved agent instruction changes?');
	expect(canLeaveInstructions('instructions', false)).toBe(true);
	expect(canLeaveInstructions('workspace', true)).toBe(true);

	confirm.mockReturnValue(true);
	expect(canLeaveInstructions('instructions', true)).toBe(true);
});
