import { CodexHarness } from '../../../../src/main/coding/harness/codex';
import type { HarnessContext } from '../../../../src/main/coding/harness/types';
import { CodexRpc } from '../../../../src/main/coding/harness/rpc';

jest.mock('../../../../src/main/coding/harness/executable', () => ({
	codexExecutable: () => '/mock/codex',
}));
jest.mock('node:fs/promises', () => ({ mkdir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../../src/main/coding/harness/rpc');

describe('CodexHarness', () => {
	let rpc: jest.Mocked<CodexRpc>;
	let context: HarnessContext;
	let controller: AbortController;
	beforeEach(() => {
		rpc = {
			initialize: jest.fn().mockResolvedValue(undefined),
			request: jest.fn(),
			close: jest.fn(),
		} as unknown as jest.Mocked<CodexRpc>;
		jest.mocked(CodexRpc).mockImplementation(() => rpc);
		controller = new AbortController();
		context = {
			cwd: '/projects/example',
			settings: {
				runtime: 'codex',
				providerId: 'openai-codex',
				modelId: 'test-model',
				toolMode: 'coding',
				thinkingLevel: 'medium',
			},
			signal: controller.signal,
			emit: jest.fn(),
			approve: jest.fn().mockResolvedValue({ approved: true }),
			saveSession: jest.fn().mockResolvedValue(undefined),
		};
		rpc.request.mockImplementation(async (method) => {
			if (method === 'account/read') return { account: { type: 'chatgpt' } };
			if (method === 'thread/start' || method === 'thread/resume')
				return { thread: { id: 'native-thread' } };
			if (method === 'turn/start') {
				rpc.onNotification?.('turn/started', { threadId: 'native-thread', turn: { id: 'turn-1' } });
				rpc.onNotification?.('item/agentMessage/delta', {
					threadId: 'native-thread',
					itemId: 'message-1',
					delta: 'Hello',
				});
				rpc.onNotification?.('turn/completed', {
					threadId: 'native-thread',
					turn: { status: 'completed' },
				});
			}
			return {};
		});
	});

	it('pins cwd and persists the native thread after starting its first turn', async () => {
		await expect(
			new CodexHarness('/coder/codex', () => undefined).run('Task', context)
		).resolves.toBe('Hello');
		expect(rpc.request).toHaveBeenCalledWith(
			'thread/start',
			expect.objectContaining({
				cwd: context.cwd,
				sandbox: 'workspace-write',
				approvalPolicy: 'on-request',
			})
		);
		expect(context.saveSession).toHaveBeenCalledWith('native-thread');
		expect(context.emit).toHaveBeenCalledWith({ type: 'text-delta', delta: 'Hello' });
		expect(rpc.close).toHaveBeenCalled();
	});

	it('resumes the native session with read-only permissions', async () => {
		await new CodexHarness('/coder/codex', () => undefined).run('Task', {
			...context,
			nativeSessionId: 'native-thread',
			settings: { ...context.settings, toolMode: 'read-only' },
		});
		expect(rpc.request).toHaveBeenCalledWith(
			'thread/resume',
			expect.objectContaining({
				threadId: 'native-thread',
				sandbox: 'read-only',
				approvalPolicy: 'never',
			})
		);
	});

	it('rejects interrupted startup and closes its process', async () => {
		rpc.initialize.mockImplementation(async () => {
			controller.abort();
		});
		await expect(
			new CodexHarness('/coder/codex', () => undefined).run('Task', context)
		).rejects.toThrow();
		expect(rpc.close).toHaveBeenCalled();
	});

	it('translates approval requests without accepting foreign sessions', async () => {
		const implementation = rpc.request.getMockImplementation()!;
		rpc.request.mockImplementation(async (method, params) => {
			if (method === 'turn/start') {
				await expect(
					rpc.onRequest?.('item/fileChange/requestApproval', { threadId: 'other' })
				).rejects.toThrow('active session');
				await expect(
					rpc.onRequest?.('item/fileChange/requestApproval', {
						threadId: 'native-thread',
						itemId: 'edit',
					})
				).resolves.toEqual({ decision: 'accept' });
			}
			return implementation(method, params);
		});
		await new CodexHarness('/coder/codex', () => undefined).run('Task', context);
		expect(context.approve).toHaveBeenCalledWith(
			expect.objectContaining({ toolName: 'fileChange' })
		);
	});

	it('propagates runtime failures', async () => {
		rpc.request.mockImplementation(async (method) => {
			if (method === 'account/read') return { account: {} };
			if (method === 'thread/start') return { thread: { id: 'native-thread' } };
			if (method === 'turn/start')
				rpc.onNotification?.('turn/completed', {
					threadId: 'native-thread',
					turn: { status: 'failed', error: { message: 'Rate limit' } },
				});
			return {};
		});
		await expect(
			new CodexHarness('/coder/codex', () => undefined).run('Task', context)
		).rejects.toThrow('Rate limit');
	});
});
