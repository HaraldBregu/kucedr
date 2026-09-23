import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const successfulTurn = async function* () {
	yield* [];
	return { content: 'done', model: 'test-model', toolCalls: [] };
};
const toolTurn = (toolIds: string[]) =>
	async function* () {
		yield* [];
		return {
			content: '',
			model: 'test-model',
			toolCalls: toolIds.map((name) => ({ id: `call-${name}`, name, args: {} })),
		};
	};
const runModelTurnMock = jest.fn(successfulTurn);
const appendRunMock = jest.fn();
const closeMcpMock = jest.fn();
const mockLoadMcpTools = jest.fn(async () => ({
	tools: [],
		diagnostics: { configuredServers: 0, enabledServers: 0, connectedServers: 0, listedTools: 0, loadedTools: 0, rejectedTools: 0, truncated: false, failures: [] },
	close: closeMcpMock,
}));
const createSkillRegistrySnapshotMock = jest.fn((_options?: unknown) => ({
	skills: [],
	diagnostics: [],
}));
const activateSkillMock = jest.fn();

jest.mock('../../../../../src/main/settings_store', () => ({
	getModelId: jest.fn(() => 'test-model'),
	getResolvedProvider: jest.fn(() => ({ id: 'test-provider', apiKey: 'key' })),
}));

jest.mock('../../../../../src/main/agent/runner/run_model_turn', () => ({
	runModelTurn: (...args: unknown[]) => runModelTurnMock(...args),
}));

jest.mock('../../../../../src/main/agent/session/session_append_run', () => ({
	appendRun: (...args: unknown[]) => appendRunMock(...args),
}));

jest.mock('../../../../../src/main/agent/tools/mcp/loader', () => ({
	loadMcpTools: (...args: unknown[]) => mockLoadMcpTools(...args),
}));

jest.mock('../../../../../src/main/agent/skills', () => ({
	createSkillRegistrySnapshot: (...args: unknown[]) => createSkillRegistrySnapshotMock(...args),
	activateSkill: (...args: unknown[]) => activateSkillMock(...args),
}));

import { stream } from '../../../../../src/main/agent/runner/run_stream';
import type { ExecSandbox } from '../../../../../src/main/agent/sandbox';
import { createSessionState } from '../../../../../src/main/agent/session';
import type { Message } from '../../../../../src/main/agent/types';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';
import { ExecutionBudget } from '../../../../../src/main/agent/execution/budget';

const sandbox = {} as ExecSandbox;

describe('run stream system prompt', () => {
	beforeEach(() => {
		runModelTurnMock.mockReset().mockImplementation(successfulTurn);
		appendRunMock.mockReset();
		closeMcpMock.mockReset();
		mockLoadMcpTools.mockReset().mockResolvedValue({
			tools: [],
			diagnostics: { configuredServers: 0, enabledServers: 0, connectedServers: 0, listedTools: 0, loadedTools: 0, rejectedTools: 0, truncated: false, failures: [] },
			close: closeMcpMock,
		});
		createSkillRegistrySnapshotMock.mockReset().mockReturnValue({ skills: [], diagnostics: [] });
		activateSkillMock.mockReset();
	});

	const registrySkill = {
		id: 'writer',
		name: 'writer',
		description: 'Draft polished documents',
		location: '/canonical/skills/writer',
		folderPath: '/canonical/skills/writer',
		manifest: {
			name: 'writer',
			description: 'Draft polished documents',
			allowedTools: ['read'],
		},
		source: 'local-filesystem',
		trust: 'user-controlled',
		hash: 'writer-hash',
	} as const;
	const activatedSkill = {
		id: 'writer',
		name: 'writer',
		canonicalRoot: '/canonical/skills/writer',
		instructions: 'EXACT WRITER INSTRUCTIONS',
		source: 'local-filesystem',
		trust: 'user-controlled',
		hash: 'writer-hash',
		allowedTools: ['read'],
		resources: ['references/style.md'],
		warnings: [],
	} as const;

	it.each(['minimal', 'workspace'] as const)(
		'injects an explicitly selected skill before the first %s model turn',
		async (contextMode) => {
			const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-explicit-skill-'));
			createSkillRegistrySnapshotMock.mockReturnValue({ skills: [registrySkill], diagnostics: [] });
			activateSkillMock.mockResolvedValue(activatedSkill);
			const session = createSessionState();
			session.messages = [{ role: 'user', content: 'Draft this' }];
			const events = [];
			try {
				for await (const event of stream(
					{ location: root },
					session,
					{
						runId: `explicit-${contextMode}`,
						task: 'chat',
						message: 'Draft this',
						model: 'test-model',
						type: 'default',
						agentId: 'main',
						contextMode,
						explicitSkill: 'writer',
					},
					new AbortController().signal,
					{ sandbox }
				))
					events.push(event);

				expect(activateSkillMock).toHaveBeenCalledWith(
					expect.objectContaining({ skills: [registrySkill] }),
					'writer'
				);
				const protectedPrompt = runModelTurnMock.mock.calls[0][9] as string;
				expect(protectedPrompt).toContain('EXACT WRITER INSTRUCTIONS');
				expect(protectedPrompt).toContain('"canonicalRoot":"/canonical/skills/writer"');
				expect(protectedPrompt).toContain('references/style.md');
				expect(events[0]).toMatchObject({
					type: 'run_started',
					tools: expect.arrayContaining(['load_skill']),
				});
				if (events[0]?.type !== 'run_started') throw new Error('Expected run_started');
		expect(events[0].tools).toEqual(expect.arrayContaining(['read', 'load_skill']));
			} finally {
				await fs.rm(root, { recursive: true, force: true });
			}
		}
	);

	it('loads an implicit skill in minimal mode without transporting its body through tool output', async () => {
		createSkillRegistrySnapshotMock.mockReturnValue({ skills: [registrySkill], diagnostics: [] });
		activateSkillMock.mockResolvedValue(activatedSkill);
		runModelTurnMock
			.mockImplementationOnce(async function* () {
				yield* [];
				return {
					content: '',
					model: 'test-model',
					toolCalls: [{ id: 'load', name: 'load_skill', args: { name: 'writer' } }],
				};
			})
			.mockImplementationOnce(successfulTurn);
		const session = createSessionState();
		session.messages = [{ role: 'user', content: 'Draft this' }];
		for await (const event of stream(
			{ location: '/workspace' },
			session,
			{
				runId: 'implicit-minimal',
				task: 'chat',
				message: 'Draft this',
				model: 'test-model',
				type: 'default',
				agentId: 'main',
				contextMode: 'minimal',
			},
			new AbortController().signal,
			{ sandbox }
		))
			void event;

		expect(createSkillRegistrySnapshotMock).toHaveBeenCalledWith({ projectRoot: '/workspace' });
		expect((runModelTurnMock.mock.calls[0][5] as Array<{ id: string }>).map((tool) => tool.id)).toEqual(
			expect.arrayContaining(['load_skill'])
		);
		const firstTurnTools = runModelTurnMock.mock.calls[0][5] as Array<{
			id: string;
			description: string;
		}>;
		expect(firstTurnTools.find((tool) => tool.id === 'load_skill')?.description).toContain(
			'Draft polished documents'
		);
		expect(runModelTurnMock.mock.calls[1][9]).toContain('EXACT WRITER INSTRUCTIONS');
		expect((runModelTurnMock.mock.calls[1][5] as Array<{ id: string }>).map((tool) => tool.id)).not.toContain(
			'read'
		);
		const receipt = session.messages.find(
			(message) => message.toolCalls?.[0]?.name === 'load_skill'
		)?.toolCalls?.[0]?.result?.content;
		expect(receipt).toContain('"activated":true');
		expect(receipt).not.toContain('EXACT WRITER INSTRUCTIONS');
	});

	it('surfaces explicit activation errors before model inference', async () => {
		createSkillRegistrySnapshotMock.mockReturnValue({ skills: [], diagnostics: [] });
		activateSkillMock.mockRejectedValue(
			new Error('Skill "missing" was not found in this run\'s registry.')
		);
		const events = [];
		await expect(async () => {
			for await (const event of stream(
				{ location: '/workspace' },
				createSessionState(),
				{
					runId: 'missing',
					task: 'chat',
					message: 'request',
					model: 'test-model',
					type: 'default',
					agentId: 'main',
					contextMode: 'minimal',
					explicitSkill: 'missing',
				},
				new AbortController().signal,
				{ tools: [] }
			))
				events.push(event);
		}).rejects.toThrow('not found');
		expect(events).toContainEqual(
			expect.objectContaining({ type: 'run_error', message: expect.stringContaining('not found') })
		);
		expect(runModelTurnMock).not.toHaveBeenCalled();
	});

	it('lists skills even when the registry is empty and omits the unavailable activation tool', async () => {
		const events = [];
		for await (const event of stream(
			{ location: '/workspace' },
			createSessionState(),
			{
				runId: 'empty-skills',
				task: 'chat',
				message: 'request',
				model: 'test-model',
				type: 'default',
				agentId: 'main',
				contextMode: 'minimal',
			},
			new AbortController().signal,
			{ sandbox }
		))
			events.push(event);
		expect(events[0]).toMatchObject({ type: 'run_started' });
		if (events[0]?.type !== 'run_started') throw new Error('Expected run_started');
		expect(events[0].tools).toContain('list_skills');
		expect(events[0].tools).not.toContain('load_skill');
	});

	it('can expose skill listing without exposing skill loading', async () => {
		const events = [];
		for await (const event of stream(
			{ location: '/workspace' },
			createSessionState(),
			{
				runId: 'list-only-skills',
				task: 'chat',
				message: 'list skills',
				model: 'test-model',
				type: 'default',
				agentId: 'main',
				contextMode: 'minimal',
				toolsAllow: ['list_skills'],
			},
			new AbortController().signal,
			{ sandbox }
		))
			events.push(event);
		expect(events[0]).toMatchObject({ type: 'run_started' });
		if (events[0]?.type !== 'run_started') throw new Error('Expected run_started');
		expect(events[0].tools).toEqual(['list_skills']);
		expect(events[0].tools).not.toContain('load_skill');
	});

	it('applies main toolsAllow and toolsDeny to the subagent tool', async () => {
		const noTools = [];
		for await (const event of stream(
			{ location: '/workspace' },
			createSessionState(),
			{
				runId: 'allow-none',
				task: 'chat',
				message: 'answer directly',
				model: 'test-model',
				type: 'default',
				agentId: 'main',
				contextMode: 'minimal',
				toolsAllow: [],
			},
			new AbortController().signal,
			{ sandbox }
		))
			noTools.push(event);
		expect(noTools[0]).toMatchObject({ type: 'run_started', tools: [] });

		const denied = [];
		for await (const event of stream(
			{ location: '/workspace' },
			createSessionState(),
			{
				runId: 'deny-subagent',
				task: 'chat',
				message: 'use native tools',
				model: 'test-model',
				type: 'default',
				agentId: 'main',
				contextMode: 'minimal',
				toolsDeny: ['subagent'],
			},
			new AbortController().signal,
			{ sandbox }
		))
			denied.push(event);
		expect(denied[0]).toMatchObject({ type: 'run_started' });
		if (denied[0]?.type !== 'run_started') throw new Error('Expected run_started');
		expect(denied[0].tools).not.toContain('subagent');
		expect(denied[0].tools).not.toContain('subagent');
		expect(closeMcpMock).toHaveBeenCalledTimes(1);
	});

	it('sends workspace files as user context instead of system instructions', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-run-prompt-'));
		try {
			await fs.writeFile(path.join(root, 'USER.md'), '- **Name:** Alice');
			const session = createSessionState();
			session.id = 'session';
			session.messages = [{ role: 'user', content: 'Current request' }];

			for await (const event of stream(
				{ location: root },
				session,
				{
					runId: 'run',
					task: 'chat',
					message: 'Current request',
					model: 'test-model',
					type: 'default',
					agentId: 'main',
					contextMode: 'workspace',
				},
				new AbortController().signal,
				{ tools: [] }
			))
				void event;

			const systemPrompt = runModelTurnMock.mock.calls[0][3] as string;
			const messages = runModelTurnMock.mock.calls[0][4] as Message[];
			const contextMessages = runModelTurnMock.mock.calls[0][15] as Message[];
			expect(systemPrompt).not.toContain('Alice');
			expect(contextMessages[0]).toMatchObject({
				role: 'user',
				content: expect.stringContaining('- **Name:** Alice'),
			});
			expect(messages[0]).toEqual({ role: 'user', content: 'Current request' });
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});

	it('includes the user profile in a minimal main-agent turn', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-run-profile-'));
		try {
			await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agent rules');
			await fs.writeFile(path.join(root, 'IDENTITY.md'), '# Identity');
			await fs.writeFile(path.join(root, 'SOUL.md'), '# Soul');
			await fs.writeFile(path.join(root, 'USER.md'), '- **Name:** Alice');
			const session = createSessionState();
			session.messages = [{ role: 'user', content: 'Hello' }];

			for await (const event of stream(
				{ location: root },
				session,
				{
					runId: 'minimal-profile',
					task: 'chat',
					message: 'Hello',
					model: 'test-model',
					type: 'default',
					agentId: 'main',
					contextMode: 'minimal',
				},
				new AbortController().signal,
				{ tools: [] }
			))
				void event;

			const contextMessages = runModelTurnMock.mock.calls[0][15] as Message[];
			expect(contextMessages[0]).toMatchObject({
				role: 'user',
				content: expect.stringContaining('### USER.md\n- **Name:** Alice'),
			});
			for (const name of ['AGENTS.md', 'IDENTITY.md', 'SOUL.md']) {
				expect(contextMessages[0]?.content).toContain(`### ${name}`);
			}
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});

	it('loads a pending bootstrap for a minimal main-agent turn', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-run-bootstrap-'));
		try {
			await fs.writeFile(path.join(root, 'BOOTSTRAP.md'), '# First-run conversation');
			const session = createSessionState();
			session.messages = [{ role: 'user', content: 'Hello' }];

			for await (const event of stream(
				{ location: root },
				session,
				{
					runId: 'bootstrap',
					task: 'chat',
					message: 'Hello',
					model: 'test-model',
					type: 'default',
					agentId: 'main',
					contextMode: 'minimal',
					interactionMode: 'default',
				},
				new AbortController().signal,
				{ tools: [] }
			))
				void event;

			const systemPrompt = runModelTurnMock.mock.calls[0][3] as string;
			const contextMessages = runModelTurnMock.mock.calls[0][15] as Message[];
			expect(systemPrompt).toContain('\n\n## Workspace\n');
			expect(contextMessages[0]).toMatchObject({
				role: 'user',
				content: expect.stringContaining('### BOOTSTRAP.md'),
			});

			await fs.rm(path.join(root, 'BOOTSTRAP.md'));
			runModelTurnMock.mockClear();
			for await (const event of stream(
				{ location: root },
				createSessionState(),
				{
					runId: 'after-bootstrap',
					task: 'chat',
					message: 'Hello again',
					model: 'test-model',
					type: 'default',
					agentId: 'main',
					contextMode: 'minimal',
					interactionMode: 'default',
				},
				new AbortController().signal,
				{ tools: [] }
			))
				void event;

			expect(runModelTurnMock.mock.calls[0][3]).not.toContain('\n\n## Workspace\n');
			expect(runModelTurnMock.mock.calls[0][15]).toEqual([]);
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});

	it.each(['minimal', 'workspace'] as const)('injects untrusted automatic memory into %s main chat', async (contextMode) => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-main-memory-'));
		const session = createSessionState();
		session.category = 'main';
		session.messages = [{ role: 'user', content: 'Current correction' }];
		const context = jest.fn(async () => '- Prefers concise answers.');
		for await (const event of stream(
			{ location: root },
			session,
			{
				runId: `memory-${contextMode}`,
				task: 'chat',
				message: 'Current correction',
				model: 'test-model',
				type: 'default',
				agentId: 'main',
				contextMode,
				interactionMode: 'default',
			},
			new AbortController().signal,
			{ tools: [], memory: { context } as never }
		)) void event;
		expect(context).toHaveBeenCalledWith('Current correction');
		expect(runModelTurnMock.mock.calls[0][10]).toEqual([
			expect.objectContaining({
				role: 'user',
				content: expect.stringContaining('explicit corrections override this recalled context'),
			}),
		]);
		await fs.rm(root, { recursive: true, force: true });
	});

	it.each(['bot', 'task', 'health', 'subagent'] as const)('keeps personal memory out of %s runs even in workspace mode', async (category) => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-isolated-memory-'));
		const session = createSessionState();
		session.category = category;
		session.messages = [{ role: 'user', content: 'Background request' }];
		const context = jest.fn(async () => '- Private preference.');
		for await (const event of stream(
			{ location: root },
			session,
			{
				runId: `isolated-${category}`,
				task: 'chat',
				message: 'Background request',
				model: 'test-model',
				type: 'background',
				agentId: category,
				contextMode: 'workspace',
				interactionMode: 'default',
			},
			new AbortController().signal,
			{ tools: [], memory: { context } as never }
		)) void event;
		expect(context).not.toHaveBeenCalled();
		expect(JSON.stringify(runModelTurnMock.mock.calls[0][10])).not.toContain('Private preference');
		await fs.rm(root, { recursive: true, force: true });
	});

	it('keeps pending bootstrap context out of non-main minimal turns', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-run-bot-bootstrap-'));
		try {
			const session = createSessionState();
			session.category = 'bot';
			session.messages = [{ role: 'user', content: 'Hello' }];
			await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agent rules');
			await fs.writeFile(path.join(root, 'IDENTITY.md'), '# Identity');
			await fs.writeFile(path.join(root, 'SOUL.md'), '# Soul');
			await fs.writeFile(path.join(root, 'BOOTSTRAP.md'), '# Bootstrap');

			for await (const event of stream(
				{ location: root },
				session,
				{
					runId: 'bot-bootstrap',
					task: 'chat',
					message: 'Hello',
					model: 'test-model',
					type: 'background',
					agentId: 'channels',
					contextMode: 'minimal',
					interactionMode: 'default',
				},
				new AbortController().signal,
				{ tools: [] }
			))
				void event;

			expect(runModelTurnMock.mock.calls[0][3]).not.toContain('\n\n## Workspace\n');
			expect(runModelTurnMock.mock.calls[0][10]).toEqual([]);
			const workspaceContext = runModelTurnMock.mock.calls[0][15] as Message[];
			expect(workspaceContext[0]?.content).toEqual(expect.stringContaining('### AGENTS.md'));
			expect(workspaceContext[0]?.content).toEqual(expect.stringContaining('### IDENTITY.md'));
			expect(workspaceContext[0]?.content).toEqual(expect.stringContaining('### SOUL.md'));
			expect(workspaceContext[0]?.content).not.toContain('### BOOTSTRAP.md');
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});

	it('caps public web calls only for bot-origin runs', async () => {
		const calls = Array.from({ length: 9 }, (_, index) => ({
			id: `web-${index}`,
			name: 'search_web',
			args: { query: `query ${index}` },
		}));
		const search = jest.fn().mockResolvedValue('public result');
		const webTool = jsonTool({
			id: 'search_web',
			name: 'Search web',
			description: 'public web search',
			schema: { type: 'object' },
			execute: search,
		});
		runModelTurnMock
			.mockImplementationOnce(async function* () {
				yield* [];
				return { content: '', model: 'test-model', toolCalls: calls };
			});
		const botEvents = [];
		const botSession = createSessionState();
		botSession.messages = [{ role: 'user', content: 'public current-events question' }];
		for await (const event of stream(
			{ location: '/workspace' },
			botSession,
			{
				runId: 'bot-run',
				task: 'chat',
				message: 'search',
				model: 'test-model',
				type: 'background',
				agentId: 'channels',
				contextMode: 'minimal',
			},
			new AbortController().signal,
			{ tools: [webTool] }
		))
			botEvents.push(event);
		expect(search).not.toHaveBeenCalled();
		expect(botEvents.at(-1)).toMatchObject({
			type: 'run_finished',
			result: { stopReason: 'budget_exhausted' },
		});

		runModelTurnMock
			.mockImplementationOnce(async function* () {
				yield* [];
				return { content: '', model: 'test-model', toolCalls: calls };
			})
			.mockImplementationOnce(successfulTurn);
		const mainSession = createSessionState();
		mainSession.messages = [{ role: 'user', content: 'public current-events question' }];
		for await (const event of stream(
			{ location: '/workspace' },
			mainSession,
			{
				runId: 'main-run',
				task: 'chat',
				message: 'search',
				model: 'test-model',
				type: 'default',
				agentId: 'main',
				contextMode: 'minimal',
			},
			new AbortController().signal,
			{ tools: [webTool] }
		))
			void event;
		expect(search).toHaveBeenCalledTimes(9);
	});

	it.each(['microphone_recorder', 'camera_recorder', 'screen_recorder'])(
		'summarizes after %s starts without allowing more tools',
		async (id) => {
			const recorder = jsonTool({
				id,
				name: id,
				description: id,
				schema: { type: 'object' },
				execute: () => ({ id: 'recording-1', status: 'recording' }),
			});
			runModelTurnMock
				.mockImplementationOnce(async function* () {
					yield* [];
					return {
						content: '',
						model: 'test-model',
						toolCalls: [{ id: 'record', name: id, args: {} }],
					};
				})
				.mockImplementationOnce(successfulTurn);
			const events = [];
			for await (const event of stream(
				{ location: '/workspace' },
				createSessionState(),
				{
					runId: `${id}-run`,
					task: 'chat',
					message: 'Start recording',
					model: 'test-model',
					type: 'default',
					agentId: 'main',
					contextMode: 'minimal',
				},
				new AbortController().signal,
				{ tools: [recorder] }
			))
				events.push(event);

			expect(runModelTurnMock).toHaveBeenCalledTimes(2);
			expect(runModelTurnMock.mock.calls[1][5]).toEqual([]);
			expect(events.at(-1)).toMatchObject({
				type: 'run_finished',
				result: { text: 'done', stopReason: 'end_turn' },
			});
		}
	);

	it('rejects a malformed Plan response before publishing it', async () => {
		const events = [];
		await expect(async () => {
			for await (const event of stream(
				{ location: '/workspace' },
				createSessionState(),
				{
					runId: 'plan-output',
					task: 'chat',
					message: 'Plan this',
					model: 'test-model',
					type: 'default',
					agentId: 'main',
					contextMode: 'minimal',
					interactionMode: 'plan',
				},
				new AbortController().signal,
				{ tools: [] }
			))
				events.push(event);
		}).rejects.toThrow('exactly one non-empty <proposed_plan> envelope');

		expect(events).not.toContainEqual(expect.objectContaining({ type: 'assistant_message' }));
		expect(events).toContainEqual(
			expect.objectContaining({
				type: 'run_error',
				message: expect.stringContaining('<proposed_plan>'),
			})
		);
	});

	it('emits exactly one terminal event when cancelled', async () => {
		const session = createSessionState();
		session.id = 'session';
		const controller = new AbortController();
		controller.abort(new Error('cancelled'));
		const events = [];

		for await (const event of stream(
			{ location: '/workspace' },
			session,
			{
				runId: 'run',
				task: 'chat',
				message: 'request',
				model: 'test-model',
				type: 'default',
				agentId: 'main',
				contextMode: 'minimal',
			},
			controller.signal,
			{ tools: [] }
		))
			events.push(event);

		expect(events.filter((event) => event.type === 'run_finished')).toHaveLength(1);
		expect(events.at(-1)).toMatchObject({
			type: 'run_finished',
			result: { stopReason: 'cancelled' },
		});
	});

	it('emits exactly one terminal event before propagating a model failure', async () => {
		runModelTurnMock.mockImplementationOnce(async function* () {
			yield* [];
			throw new Error('provider failed');
		});
		const session = createSessionState();
		session.id = 'session';
		const events = [];

		await expect(async () => {
			for await (const event of stream(
				{ location: '/workspace' },
				session,
				{
					runId: 'run',
					task: 'chat',
					message: 'request',
					model: 'test-model',
					type: 'default',
					agentId: 'main',
					contextMode: 'minimal',
				},
				new AbortController().signal,
				{ tools: [] }
			))
				events.push(event);
		}).rejects.toThrow('provider failed');

		expect(events.filter((event) => event.type === 'run_finished')).toHaveLength(1);
		expect(events.at(-1)).toMatchObject({
			type: 'run_finished',
			result: { stopReason: 'error' },
		});
	});

	it('emits one terminal event even when terminal trace persistence fails', async () => {
		appendRunMock.mockImplementation((_state, entry: { type?: string }) => {
			if (entry.type === 'run_finished') throw new Error('trace disk full');
		});
		const session = createSessionState();
		session.id = '11111111-1111-4111-8111-111111111111';
		const events = [];

		for await (const event of stream(
			{ location: '/workspace' },
			session,
			{
				runId: 'run',
				task: 'chat',
				message: 'request',
				model: 'test-model',
				type: 'default',
				agentId: 'main',
				contextMode: 'minimal',
			},
			new AbortController().signal,
			{ tools: [] }
		))
			events.push(event);

		expect(events.filter((event) => event.type === 'run_finished')).toHaveLength(1);
		expect(events.at(-1)?.type).toBe('run_finished');
	});

	it('pins the resolved execution contract for delegated children', async () => {
		const scope = {
			ownerId: 'channel',
			source: 'channel' as const,
			sessionId: 'parent',
			runId: 'parent',
		};
		runModelTurnMock.mockImplementation(async function* (input: { agentId: string }) {
			yield* [];
			if (input.agentId === 'subagent')
				return { content: 'child result', model: 'pinned-model', toolCalls: [] };
			const mainCalls = runModelTurnMock.mock.calls.filter(
				(call) => call[0].agentId === 'main'
			).length;
			return mainCalls === 1
				? {
						content: '',
						model: 'pinned-model',
						toolCalls: [
							{
								id: 'delegate',
								name: 'subagent',
								args: { task: 'inspect' },
							},
						],
					}
				: mainCalls === 2
					? {
							content: '',
							model: 'pinned-model',
							toolCalls: [{ id: 'delegate', name: 'subagent', args: { task: 'inspect' } }],
						}
					: { content: 'parent result', model: 'pinned-model', toolCalls: [] };
		});

		for await (const _event of stream(
			{ location: '/workspace' },
			createSessionState(),
			{
				runId: 'parent-run',
				task: 'chat',
				message: 'delegate',
				providerId: 'configured-provider',
				model: 'pinned-model',
				effort: 'high',
				type: 'background',
				agentId: 'main',
				contextMode: 'minimal',
				interactionMode: 'default',
				scope,
			},
			new AbortController().signal,
			{ sandbox, modelOptions: { temperature: 0.2 } }
		))
			void _event;

		const childCall = runModelTurnMock.mock.calls.find((call) => call[0].agentId === 'subagent');
		const childInput = childCall?.[0];
		expect(childInput).toMatchObject({
			providerId: 'test-provider',
			model: 'pinned-model',
			effort: 'high',
			scope,
		});
		expect(childCall?.[7]).toEqual({ temperature: 0.2 });
		expect(childCall?.[9]).toBe('');
	});

	it('allows one final synthesis turn after a delegation exhausts its work budget', async () => {
		const budget = new ExecutionBudget({ output: 1 });
		const subagents = jsonTool({
			id: 'subagents',
			name: 'Subagents',
			description: 'delegate work',
			schema: { type: 'object' },
			execute: () => {
				budget.observeOutput(1);
				return [{ id: 'research', status: 'exhausted' }];
			},
		});
		runModelTurnMock
			.mockImplementationOnce(async function* () {
				yield* [];
				return {
					content: '',
					model: 'test-model',
					toolCalls: [{ id: 'delegate', name: 'subagents', args: {} }],
				};
			})
			.mockImplementationOnce(successfulTurn);
		const events = [];
		for await (const event of stream(
			{ location: '/workspace' },
			createSessionState(),
			{
				runId: 'delegation-synthesis',
				task: 'chat',
				message: 'delegate then summarize',
				model: 'test-model',
				type: 'default',
				agentId: 'main',
				contextMode: 'minimal',
			},
			new AbortController().signal,
			{ tools: [subagents], budget }
		))
			events.push(event);

		expect(runModelTurnMock).toHaveBeenCalledTimes(2);
		expect(runModelTurnMock.mock.calls[1][5]).toEqual([]);
		expect(events.at(-1)).toMatchObject({
			type: 'run_finished',
			result: { text: 'done', stopReason: 'budget_exhausted' },
		});
	});
	it.each(['output', 'calls', 'turns', 'empty'] as const)(
		'produces a final answer after the %s boundary',
		async (boundary) => {
			const execute = jest.fn(() => 'observed result');
			const tool = jsonTool({
				id: 'search_web',
				name: 'Search',
				description: 'Search',
				schema: { type: 'object' },
				execute,
			});
			const budget = new ExecutionBudget(
				boundary === 'output' ? { output: 1 } : boundary === 'calls' ? { calls: 0 } : {}
			);
			const session = createSessionState();
			if (boundary === 'turns') session.maxTurns = 2;
			runModelTurnMock.mockImplementationOnce(async function* () {
				yield* [];
				return {
					content: '',
					model: 'test-model',
					toolCalls: boundary === 'empty' ? [] : [{ id: 'search', name: tool.id, args: {} }],
				};
			});
			const events = [];
			for await (const event of stream(
				{ location: '/workspace' },
				session,
				{
					task: 'chat',
					model: 'test-model',
					message: 'search then answer',
					agentId: 'main',
					contextMode: 'minimal',
				},
				new AbortController().signal,
				{ tools: [tool], budget }
			))
				events.push(event);

			expect(runModelTurnMock).toHaveBeenCalledTimes(2);
			if (boundary !== 'turns') expect(runModelTurnMock.mock.calls[1][5]).toEqual([]);
			expect(execute).toHaveBeenCalledTimes(['output', 'turns'].includes(boundary) ? 1 : 0);
			expect(events.at(-1)).toMatchObject({
				type: 'run_finished',
				result: {
					text: 'done',
					subtype: 'success',
					stopReason:
					['calls', 'output'].includes(boundary)
								? 'budget_exhausted'
								: 'end_turn',
				},
			});
			if (boundary === 'calls') {
				expect(session.toolCalls[0].result).toMatchObject({
					isError: true,
				});
				expect(events).toContainEqual(
					expect.objectContaining({ type: 'tool_call_end', isError: true })
				);
			}
		}
	);

	it('reports an error instead of silently completing when synthesis is empty', async () => {
		runModelTurnMock.mockImplementation(async function* () {
			yield* [];
			return { content: '   ', model: 'test-model', toolCalls: [] };
		});
		const events = [];
		await expect(async () => {
			for await (const event of stream(
				{ location: '/workspace' },
				createSessionState(),
				{
					task: 'chat',
					model: 'test-model',
					message: 'answer',
					agentId: 'main',
					contextMode: 'minimal',
				},
				new AbortController().signal,
				{ tools: [] }
			))
				events.push(event);
		}).rejects.toThrow('non-empty final answer');
		expect(runModelTurnMock).toHaveBeenCalledTimes(2);
		expect(events.at(-1)).toMatchObject({ type: 'run_finished', result: { stopReason: 'error' } });
	});

	it.each(['cancel', 'tools', 'empty'] as const)(
		'keeps finalization bounded when the next outcome is %s',
		async (outcome) => {
			const controller = new AbortController();
			const execute = jest.fn(() => 'observed result');
			const tool = jsonTool({
				id: 'search_web',
				name: 'Search',
				description: 'Search',
				schema: { type: 'object' },
				execute,
			});
			const session = createSessionState();
			runModelTurnMock
				.mockImplementationOnce(async function* () {
					yield* [];
					return {
						content: '',
						model: 'test-model',
						toolCalls: [{ id: 'first', name: tool.id, args: {} }],
					};
				})
				.mockImplementationOnce(async function* () {
					yield* [];
					return {
						content: '',
						model: 'test-model',
						toolCalls: outcome === 'tools' ? [{ id: 'forbidden', name: tool.id, args: {} }] : [],
					};
				})
				.mockImplementationOnce(successfulTurn);
			const events = [];
			const run = async () => {
				for await (const event of stream(
					{ location: '/workspace' },
					session,
					{
						task: 'chat',
						model: 'test-model',
						message: 'search then answer',
						agentId: 'main',
						contextMode: 'minimal',
					},
					controller.signal,
					{ tools: [tool], budget: new ExecutionBudget(outcome === 'tools' ? { output: 1 } : {}) }
				)) {
					events.push(event);
					if (outcome === 'cancel' && event.type === 'tool_call_end') controller.abort();
				}
			};
			if (outcome === 'tools') await expect(run()).rejects.toThrow('non-empty final answer');
			else await run();
			expect(execute).toHaveBeenCalledTimes(1);
			expect(runModelTurnMock).toHaveBeenCalledTimes(
				outcome === 'cancel' ? 1 : outcome === 'tools' ? 2 : 3
			);
			expect(events.at(-1)).toMatchObject({
				type: 'run_finished',
				result: {
					stopReason:
						outcome === 'cancel' ? 'cancelled' : outcome === 'tools' ? 'error' : 'end_turn',
					...(outcome === 'empty' ? { text: 'done' } : {}),
				},
			});
			if (outcome === 'tools') expect(session.toolCalls.at(-1)?.result).toMatchObject({ isError: true });
		}
	);

	it('activates only requested file tools and executes an active batch sequentially', async () => {
		const order: string[] = [];
		const read = jsonTool({
			id: 'read',
			name: 'Read',
			description: 'Read a file',
			capability: { effects: ['read'] },
			schema: { type: 'object' },
			execute: () => order.push('read'),
		});
		const edit = jsonTool({
			id: 'edit',
			name: 'Edit',
			description: 'Edit a file',
			capability: { effects: ['read'] },
			schema: { type: 'object' },
			execute: () => order.push('edit'),
		});
		runModelTurnMock
			.mockImplementationOnce(async function* () {
				yield* [];
				return {
					content: '',
					model: 'test-model',
					toolCalls: [
						{ id: 'read-call', name: 'read', args: {} },
						{ id: 'edit-call', name: 'edit', args: {} },
					],
				};
			})
			.mockImplementationOnce(successfulTurn);

		for await (const _event of stream(
			{ location: '/workspace' },
			createSessionState(),
			{
				runId: 'file-edit',
				task: 'chat',
				message: 'Read and edit the file',
				model: 'test-model',
				type: 'default',
				agentId: 'main',
				contextMode: 'minimal',
			},
			new AbortController().signal,
			{ tools: [read, edit], progressiveDiscovery: true }
		))
			void _event;

		expect(
			(runModelTurnMock.mock.calls[0][5] as Array<{ id: string }>).map((tool) => tool.id)
		).toEqual(['discover_tools', 'read', 'edit']);
		expect(order).toEqual(['read', 'edit']);
	});

	it('consolidates premature calls into one loader turn and executes them once on the next turn', async () => {
		const bashExecute = jest.fn();
		const writeExecute = jest.fn();
		const budget = new ExecutionBudget({ calls: 2 });
		const bash = jsonTool({
			id: 'bash',
			name: 'Bash',
			description: 'Run a command',
			capability: { effects: ['execute'] },
			schema: { type: 'object' },
			execute: bashExecute,
		});
		const write = jsonTool({
			id: 'write',
			name: 'Write',
			description: 'Write a file',
			capability: { effects: ['write'] },
			schema: { type: 'object' },
			execute: writeExecute,
		});
		runModelTurnMock
			.mockImplementationOnce(async function* () {
				yield* [];
				return {
					content: '',
					model: 'test-model',
					providerItems: [{ type: 'provider_item', provider: 'openai', item: { type: 'reasoning' } }],
					toolCalls: [
						{ id: 'early-bash', name: 'bash', args: { command: 'pwd' } },
						{ id: 'early-write', name: 'write', args: { path: 'demo.txt' } },
					],
				};
			})
			.mockImplementationOnce(async function* () {
				yield* [];
				return {
					content: '',
					model: 'test-model',
					toolCalls: [
						{ id: 'retry-bash', name: 'bash', args: { command: 'pwd' } },
						{ id: 'retry-write', name: 'write', args: { path: 'demo.txt' } },
					],
				};
			})
			.mockImplementationOnce(successfulTurn);
		const session = createSessionState();
		const events = [];

		for await (const _event of stream(
			{ location: '/workspace' },
			session,
			{
				runId: 'same-turn-guard',
				task: 'chat',
				message: 'Read a file',
				model: 'test-model',
				type: 'default',
				agentId: 'main',
				contextMode: 'minimal',
			},
			new AbortController().signal,
			{ tools: [bash, write], budget, progressiveDiscovery: true }
		))
			events.push(_event);

		expect(bashExecute).toHaveBeenCalledTimes(1);
		expect(writeExecute).toHaveBeenCalledTimes(1);
		expect(budget.calls).toBe(2);
		expect(session.toolCalls.find((call) => call.id === 'early-bash')).toMatchObject({
			name: 'bash',
			args: { command: 'pwd' },
			result: { content: expect.stringContaining('no arguments from this batch were executed') },
		});
		expect(session.toolCalls.some((call) => call.id === 'early-write')).toBe(true);
		expect(
			(runModelTurnMock.mock.calls[1][5] as Array<{ id: string }>).map((tool) => tool.id)
		).toEqual(expect.arrayContaining(['bash', 'write']));
		expect(
			events.filter(
				(event) =>
					(event.type === 'tool_call_start' || event.type === 'tool_call_end') &&
					(event.toolName === 'bash' || event.toolName === 'write')
			)
		).toHaveLength(8);
		expect(JSON.stringify(events)).not.toContain("unknown tool 'bash'");
		expect(JSON.stringify(events)).not.toContain("unknown tool 'write'");
	});

	it('loads an eligible MCP tool before executing a premature direct call', async () => {
		const execute = jest.fn();
		const mcpTool = jsonTool({
			id: 'mcp__files__read_file',
			name: 'Read MCP file',
			description: 'Read a file through MCP',
			capability: { effects: ['read'] },
			schema: { type: 'object' },
			execute,
		});
		mockLoadMcpTools.mockResolvedValue({
			tools: [mcpTool],
			diagnostics: { configuredServers: 1, enabledServers: 1, connectedServers: 1, listedTools: 1, loadedTools: 1, rejectedTools: 0, truncated: false, failures: [] },
			close: closeMcpMock,
		});
		runModelTurnMock
			.mockImplementationOnce(async function* () {
				yield* [];
				return {
					content: '',
					model: 'test-model',
					toolCalls: [{ id: 'early-mcp', name: mcpTool.id, args: { path: 'demo.txt' } }],
				};
			})
			.mockImplementationOnce(async function* () {
				yield* [];
				return {
					content: '',
					model: 'test-model',
					toolCalls: [{ id: 'retry-mcp', name: mcpTool.id, args: { path: 'demo.txt' } }],
				};
			})
			.mockImplementationOnce(successfulTurn);
		const session = createSessionState();

		for await (const _event of stream(
			{ location: '/workspace' },
			session,
			{
				runId: 'mcp-loader',
				task: 'chat',
				message: 'Hello there',
				model: 'test-model',
				type: 'default',
				agentId: 'main',
				contextMode: 'minimal',
			},
			new AbortController().signal,
			{ sandbox }
		))
			void _event;

		expect(session.toolCalls.find((call) => call.id === 'early-mcp')).toMatchObject({
			name: mcpTool.id,
			args: { path: 'demo.txt' },
		});
		expect(
			(runModelTurnMock.mock.calls[1][5] as Array<{ id: string }>).map((tool) => tool.id)
		).toContain(mcpTool.id);
		expect(execute).toHaveBeenCalledTimes(1);
	});
});
