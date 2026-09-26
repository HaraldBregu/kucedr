import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { ClaudeHarness } from '../../../../src/main/coding/harness/claude';
import type { HarnessContext } from '../../../../src/main/coding/harness/types';

jest.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: jest.fn() }));

const mockQuery = jest.mocked(query);
let directory: string;
let harness: ClaudeHarness;
let context: HarnessContext;

beforeEach(async () => {
	mockQuery.mockReset();
	directory = await mkdtemp(join(tmpdir(), 'coder-claude-'));
	harness = new ClaudeHarness(join(directory, 'state'), () => 'test-key');
	Object.defineProperty(harness, 'executable', { value: () => '/tmp/claude-test-binary' });
	context = {
		cwd: directory,
		settings: {
			runtime: 'claude',
			providerId: 'anthropic',
			modelId: 'sonnet',
			thinkingLevel: 'medium',
			toolMode: 'read-only',
		},
		signal: new AbortController().signal,
		emit: jest.fn(),
		approve: jest.fn().mockResolvedValue({ approved: false }),
		saveSession: jest.fn().mockResolvedValue(undefined),
	};
});

afterEach(async () => {
	harness.destroy();
	await rm(directory, { recursive: true, force: true });
});

test('isolates credentials and settings, reads only project instructions and denies writes', async () => {
	await writeFile(join(directory, 'CLAUDE.md'), 'Project instructions');
	const session = { async *[Symbol.asyncIterator]() {}, close: jest.fn() };
	mockQuery.mockReturnValue(session as never);
	await harness.run('Inspect project', context);
	const options = mockQuery.mock.calls[0][0].options!;
	expect(options.env?.CLAUDE_CONFIG_DIR).toBe(join(directory, 'state'));
	expect(options.env?.ANTHROPIC_API_KEY).toBe('test-key');
	expect(options.env?.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
	expect(options.settingSources).toEqual([]);
	expect(options.systemPrompt).toMatchObject({ append: 'Project instructions' });
	expect(options.tools).toEqual(['Read', 'Glob', 'Grep']);
	const denial = await options.canUseTool!(
		'Write',
		{ file_path: 'a' },
		{ signal: context.signal, toolUseID: 't' }
	);
	expect(denial.behavior).toBe('deny');
	expect(context.approve).not.toHaveBeenCalled();
	expect(session.close).toHaveBeenCalled();
});

test('streams text once, persists native identity and reports tool results', async () => {
	const messages = [
		{ type: 'system', subtype: 'init', session_id: 'native' },
		{
			type: 'stream_event',
			session_id: 'native',
			parent_tool_use_id: null,
			event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
		},
		{
			type: 'assistant',
			parent_tool_use_id: null,
			message: {
				content: [
					{ type: 'text', text: 'Hello' },
					{ type: 'tool_use', id: 'tool-1', name: 'Read' },
				],
			},
		},
		{
			type: 'user',
			message: {
				content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'file', is_error: false }],
			},
		},
		{ type: 'result', subtype: 'success', result: 'Hello', is_error: false },
	];
	mockQuery.mockReturnValue({
		async *[Symbol.asyncIterator]() {
			yield* messages;
		},
		close: jest.fn(),
	} as never);
	expect(await harness.run('Inspect', context)).toBe('Hello');
	expect(context.saveSession).toHaveBeenCalledTimes(1);
	expect(context.saveSession).toHaveBeenCalledWith('native');
	expect(context.emit).toHaveBeenCalledWith({
		type: 'tool-end',
		toolCallId: 'tool-1',
		toolName: 'Read',
		isError: false,
	});
	expect(
		jest.mocked(context.emit).mock.calls.filter(([event]) => event.type === 'text-delta')
	).toHaveLength(1);
});

test('does not launch a runtime without an API key', async () => {
	const unconfigured = new ClaudeHarness(directory, () => undefined);
	expect((await unconfigured.listModels()).providers[0].models).toEqual([]);
	await expect(unconfigured.run('Inspect', context)).rejects.toThrow('Anthropic API key');
	expect(mockQuery).not.toHaveBeenCalled();
});

test('aborts the SDK controller when the run is cancelled', async () => {
	const controller = new AbortController();
	mockQuery.mockImplementation(
		({ options }) =>
			({
				async *[Symbol.asyncIterator]() {
					controller.abort();
					expect(options?.abortController?.signal.aborted).toBe(true);
					yield { type: 'result', subtype: 'success', result: '' };
				},
				close: jest.fn(),
			}) as never
	);
	await expect(harness.run('Inspect', { ...context, signal: controller.signal })).rejects.toThrow();
});
