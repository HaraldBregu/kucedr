import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const model = jest.fn();
const launchPersistentContext = jest.fn();

jest.mock('playwright-core', () => ({ chromium: { launchPersistentContext } }));
jest.mock('../../../../../src/main/shared/user_data_location', () => {
	const directory = jest
		.requireActual<typeof fs>('node:fs')
		.mkdtempSync(
			jest
				.requireActual<typeof path>('node:path')
				.join(jest.requireActual<typeof os>('node:os').tmpdir(), 'kucedr-browser-run-')
		);
	return { userDataLocation: () => directory };
});
jest.mock('../../../../../src/main/settings_store', () => ({
	getResolvedProvider: () => ({ id: 'test-provider', apiKey: 'key' }),
}));
jest.mock('../../../../../src/main/agent/runner/run_model_turn', () => ({
	runModelTurn: (...args: unknown[]) => model(...args),
}));
jest.mock('../../../../../src/main/agent/skills', () => ({
	createSkillRegistrySnapshot: () => ({ skills: [], diagnostics: [] }),
}));
jest.mock('../../../../../src/main/agent/tools/mcp/loader', () => ({
	loadMcpTools: async () => ({ tools: [], close: async () => undefined }),
}));

import { stream } from '../../../../../src/main/agent/runner/run_stream';
import { createSessionState } from '../../../../../src/main/agent/session';
import { useWebBrowserTool } from '../../../../../src/main/agent/tools/web/use_web_browser';
import { createBackgroundBrowser } from '../../../../../src/main/agent/tools/web/browser/background';
import { userDataLocation } from '../../../../../src/main/shared/user_data_location';
import type { ExecSandbox } from '../../../../../src/main/agent/sandbox';
import type { Tool } from '../../../../../src/main/agent/types';
import { setModelId } from '../../../../../src/main/agent/agent_store';

function browserContext() {
	const events = new EventEmitter();
	return Object.assign(events, {
		pages: () => [],
		setDefaultTimeout: jest.fn(),
		close: jest.fn(async () => {
			events.emit('close');
		}),
	});
}

beforeEach(() => {
	setModelId('test-model');
	launchPersistentContext.mockReset();
	model
		.mockReset()
		.mockImplementation(async function* () {
			yield* [];
			return { content: 'done', model: 'test-model', toolCalls: [] };
		})
		.mockImplementationOnce(async function* () {
			yield* [];
			return {
				content: '',
				model: 'test-model',
				toolCalls: [
					{
						id: 'discover-browser',
						name: 'discover_tools',
						args: {
							query: 'browser',
							toolIds: ['use_web_browser'],
							mcpServerIds: [],
						},
					},
				],
			};
		})
		.mockImplementationOnce(async function* () {
			yield* [];
			return {
				content: '',
				model: 'test-model',
				toolCalls: [{ id: 'browser-start', name: 'use_web_browser', args: { action: 'start' } }],
			};
		});
});

afterAll(() => fs.rmSync(userDataLocation(), { recursive: true, force: true }));

it.each(['success', 'failure', 'cancel', 'return'])(
	'closes the task browser after %s',
	async (ending) => {
		const context = browserContext();
		launchPersistentContext.mockResolvedValue(context);
		if (ending === 'failure')
			model.mockImplementationOnce(async function* () {
				yield* [];
				throw new Error('model failed');
			});
		const controller = new AbortController();
		const events = stream(
			{ location: userDataLocation() },
			createSessionState(),
			{
				runId: 'background-browser',
				task: 'chat',
				message: 'Open browser',
				model: 'test-model',
				type: 'background',
				agentId: 'tasks',
				contextMode: 'minimal',
				scope: { ownerId: 'task', source: 'task', sessionId: 'task', runId: 'background-browser' },
			},
			controller.signal,
			{ tools: [useWebBrowserTool] }
		);
		const consume = async () => {
			for await (const event of events) {
				expect(event.type).not.toBe('tool_permission_request');
				if (event.type !== 'tool_call_end') continue;
				expect(event).toMatchObject({ permissionOutcome: 'allow', isError: undefined });
				if (ending === 'cancel') controller.abort();
				if (ending === 'return') break;
			}
		};
		if (ending === 'failure') await expect(consume()).rejects.toThrow('model failed');
		else await consume();
		expect(launchPersistentContext).toHaveBeenCalledWith(
			'',
			expect.objectContaining({ headless: true })
		);
		expect(context.close).toHaveBeenCalledTimes(1);
	}
);

it('gives a background child its own browser when it inherits the parent tools', async () => {
	const parent = createBackgroundBrowser();
	const parentContext = browserContext();
	const childContext = browserContext();
	launchPersistentContext.mockResolvedValueOnce(parentContext).mockResolvedValueOnce(childContext);
	try {
		await parent.tool.run({ action: 'start' });
		for await (const event of stream(
			{ location: userDataLocation() },
			createSessionState(),
			{
				runId: 'child-browser',
				task: 'subagent',
				message: 'Open browser',
				model: 'test-model',
				type: 'background',
				agentId: 'subagent',
				contextMode: 'minimal',
			},
			new AbortController().signal,
			{ tools: [parent.tool] }
		)) {
			if (event.type === 'tool_call_end') expect(event.permissionOutcome).toBe('allow');
		}
		expect(launchPersistentContext).toHaveBeenCalledTimes(2);
		expect(childContext.close).toHaveBeenCalledTimes(1);
		expect(parentContext.close).not.toHaveBeenCalled();
	} finally {
		await parent.close();
	}
});

it.each([
	{ agentId: 'tasks', toolsAllow: [], source: 'task' },
	{ agentId: 'channels', toolsAllow: undefined, source: 'channel' },
] as const)(
	'preserves browser restrictions for $agentId',
	async ({ agentId, toolsAllow, source }) => {
		for await (const event of stream(
			{ location: userDataLocation() },
			createSessionState(),
			{
				runId: 'restricted',
				task: 'chat',
				message: 'Open browser',
				model: 'test-model',
				type: 'background',
				agentId,
				contextMode: 'minimal',
				toolsAllow,
				scope: { ownerId: 'restricted', source, sessionId: 'restricted', runId: 'restricted' },
			},
			new AbortController().signal,
			{ tools: [useWebBrowserTool] }
		)) {
			if (event.type === 'tool_call_end') expect(event.isError).toBe(true);
		}
		expect(launchPersistentContext).not.toHaveBeenCalled();
	}
);

it('does not let channel agents delegate browser access to a background child', async () => {
	const requested = new Set<string>();
	const phases = new Map<string, number>();
	model.mockReset().mockImplementation(async function* (
		input: { agentId: string },
		_provider: unknown,
		_model: unknown,
		_prompt: unknown,
		_messages: unknown,
		tools: Tool[]
	) {
		yield* [];
		if (input.agentId === 'subagent')
			expect(tools.map((tool) => tool.id)).not.toContain('use_web_browser');
		const phase = phases.get(input.agentId) ?? 0;
		phases.set(input.agentId, phase + 1);
		if (phase >= 2) return { content: 'done', model: 'test-model', toolCalls: [] };
		if (phase === 0) {
			return {
				content: '',
				model: 'test-model',
				toolCalls: [
					{
						id: `discover-${input.agentId}`,
						name: 'discover_tools',
						args: {
							query: input.agentId === 'channels' ? 'delegate' : 'browser',
							toolIds: [input.agentId === 'channels' ? 'subagent' : 'use_web_browser'],
							mcpServerIds: [],
						},
					},
				],
			};
		}
		requested.add(input.agentId);
		return {
			content: '',
			model: 'test-model',
			toolCalls: [
				input.agentId === 'channels'
					? { id: 'delegate', name: 'subagent', args: { task: 'Open a browser' } }
					: { id: 'child-start', name: 'use_web_browser', args: { action: 'start' } },
			],
		};
	});
	for await (const event of stream(
		{ location: userDataLocation() },
		createSessionState(),
		{
			runId: 'channel-parent',
			task: 'chat',
			message: 'Open browser',
			model: 'test-model',
			type: 'background',
			agentId: 'channels',
			contextMode: 'minimal',
			scope: {
				ownerId: 'channel',
				source: 'channel',
				sessionId: 'channel',
				runId: 'channel-parent',
			},
		},
		new AbortController().signal,
		{ sandbox: {} as ExecSandbox }
	)) {
		if (event.type === 'tool_call_end') {
			if (event.toolName === 'subagent') expect(event.permissionOutcome).toBe('allow');
			if (event.toolName === 'use_web_browser') expect(event.isError).toBe(true);
		}
	}
	expect(requested).toEqual(new Set(['channels', 'subagent']));
	expect(launchPersistentContext).not.toHaveBeenCalled();
});
