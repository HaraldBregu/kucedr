import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	Agent,
	completeClineDeviceAuth,
	createBuiltinTools,
	getValidClineCredentials,
	startClineDeviceAuth,
} from '@cline/sdk';
import { ClineHarness } from '../../../../src/main/coding/harness/cline';
import type { HarnessContext } from '../../../../src/main/coding/harness/types';

jest.mock('@cline/sdk', () => ({
	Agent: jest.fn(),
	completeClineDeviceAuth: jest.fn(),
	createBuiltinTools: jest.fn(),
	getValidClineCredentials: jest.fn(),
	peekClineRecommendedModels: jest.fn(() => ({ recommended: [], free: [] })),
	startClineDeviceAuth: jest.fn(),
}));

describe('ClineHarness', () => {
	let directory: string;
	let context: HarnessContext;
	let agent: { run: jest.Mock; subscribe: jest.Mock; abort: jest.Mock };
	let listener: (event: unknown) => void;
	let saveCredential: jest.Mock;

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'kucedr-cline-test-'));
		context = {
			cwd: '/projects/example',
			settings: {
				runtime: 'cline',
				providerId: 'cline',
				modelId: 'openai/gpt-6-astra',
				thinkingLevel: 'off',
				toolMode: 'coding',
			},
			signal: new AbortController().signal,
			emit: jest.fn(),
			approve: jest.fn().mockResolvedValue({ approved: true }),
			saveSession: jest.fn().mockResolvedValue(undefined),
		};
		agent = {
			run: jest.fn().mockResolvedValue({
				status: 'completed',
				outputText: 'Done',
				messages: [{ id: 'one', role: 'assistant', content: [], createdAt: 1 }],
			}),
			subscribe: jest.fn((callback) => {
				listener = callback;
				return jest.fn();
			}),
			abort: jest.fn(),
		};
		jest.mocked(Agent).mockImplementation(() => agent as unknown as Agent);
		jest.mocked(createBuiltinTools).mockReturnValue([
			{ name: 'read_files' },
			{ name: 'run_commands' },
		] as ReturnType<typeof createBuiltinTools>);
		saveCredential = jest.fn().mockResolvedValue(undefined);
	});

	afterEach(async () => {
		jest.clearAllMocks();
		await rm(directory, { recursive: true, force: true });
	});

	it('uses the selected directory, requests write approval, streams, and persists session history', async () => {
		agent.run.mockImplementation(async () => {
			listener({ type: 'assistant-text-delta', text: 'Done' });
			listener({ type: 'tool-started', toolCall: { toolCallId: 'call', toolName: 'run_commands' } });
			return {
				status: 'completed',
				outputText: 'Done',
				messages: [{ id: 'one', role: 'assistant', content: [], createdAt: 1 }],
			};
		});
		const harness = new ClineHarness(directory, () => 'api-token', saveCredential);
		await expect(harness.run('Fix it', context)).resolves.toBe('Done');
		expect(createBuiltinTools).toHaveBeenCalledWith(expect.objectContaining({ cwd: context.cwd }));
		const options = jest.mocked(Agent).mock.calls[0][0];
		expect(options).toEqual(
			expect.objectContaining({
				providerId: 'cline',
				apiKey: 'api-token',
				modelId: context.settings.modelId,
				toolPolicies: {
					read_files: { autoApprove: true },
					run_commands: { autoApprove: false },
				},
			})
		);
		await expect(
			options.requestToolApproval!({ toolName: 'run_commands', input: { commands: ['pwd'] } } as never)
		).resolves.toEqual({ approved: true });
		expect(context.approve).toHaveBeenCalledWith({
			toolName: 'run_commands',
			input: { commands: ['pwd'] },
		});
		expect(context.emit).toHaveBeenCalledWith({ type: 'text-delta', delta: 'Done' });
		const id = jest.mocked(context.saveSession).mock.calls[0][0];
		expect(JSON.parse(await readFile(join(directory, 'sessions', `${id}.json`), 'utf8'))).toHaveLength(1);
	});

	it('restricts read-only runs to read and search tools', async () => {
		const harness = new ClineHarness(directory, () => 'api-token', saveCredential);
		await harness.run('Inspect', {
			...context,
			settings: { ...context.settings, toolMode: 'read-only' },
		});
		expect(createBuiltinTools).toHaveBeenCalledWith(
			expect.objectContaining({ enableBash: false, enableEditor: false, enableApplyPatch: false })
		);
	});

	it('refreshes account credentials before running', async () => {
		const old = { access: 'old', refresh: 'refresh', expires: 1 };
		jest.mocked(getValidClineCredentials).mockResolvedValue({ ...old, access: 'new', expires: 2 });
		const harness = new ClineHarness(directory, () => JSON.stringify(old), saveCredential);
		await harness.run('Task', context);
		expect(jest.mocked(Agent).mock.calls[0][0]).toEqual(
			expect.objectContaining({ apiKey: 'new' })
		);
		expect(saveCredential).toHaveBeenCalledWith(JSON.stringify({ ...old, access: 'new', expires: 2 }));
	});

	it('saves completed device sign-in under the caller credential store', async () => {
		jest.mocked(startClineDeviceAuth).mockResolvedValue({
			deviceCode: 'device',
			userCode: 'ABCD',
			verificationUri: 'https://example.test',
			expiresInSeconds: 600,
			pollIntervalSeconds: 5,
		});
		jest.mocked(completeClineDeviceAuth).mockResolvedValue({
			access: 'token',
			refresh: 'refresh',
			expires: 123,
		});
		const emit = jest.fn();
		const harness = new ClineHarness(directory, () => undefined, saveCredential);
		await expect(harness.connect(new AbortController().signal, emit)).resolves.toEqual({
			configured: true,
			type: 'oauth',
			source: directory,
		});
		expect(emit).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'device-code', userCode: 'ABCD' })
		);
		expect(saveCredential).toHaveBeenCalledWith(
			JSON.stringify({ access: 'token', refresh: 'refresh', expires: 123 })
		);
	});
});
