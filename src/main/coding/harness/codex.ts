import { mkdir } from 'node:fs/promises';
import type {
	CodingAuthEvent,
	CodingAuthStatus,
	CodingCatalog,
	CodingModel,
} from '../../../shared/coding_types';
import type { CodingHarness, HarnessContext } from './types';
import { codexExecutable } from './executable';
import { CodexRpc } from './rpc';

type Item = {
	id: string;
	type: string;
	text?: string;
	tool?: string;
	status?: string;
	error?: unknown;
	command?: string;
	exitCode?: number;
};
type Model = {
	model: string;
	displayName: string;
	supportedReasoningEfforts: { reasoningEffort: string }[];
};

export class CodexHarness implements CodingHarness {
	private readonly connections = new Set<CodexRpc>();

	constructor(
		private readonly directory: string,
		private readonly getApiKey: () => string | undefined
	) {}

	async run(input: string, context: HarnessContext): Promise<string> {
		context.signal.throwIfAborted();
		const rpc = await this.open();
		let threadId: string | undefined;
		let turnId: string | undefined;
		let output = '';
		const streamed = new Set<string>();
		let finish!: () => void;
		let fail!: (error: Error) => void;
		const completion = new Promise<void>((resolve, reject) => {
			finish = resolve;
			fail = reject;
		});
		void completion.catch(() => undefined);
		const abort = (): void => {
			if (threadId && turnId)
				void rpc.request('turn/interrupt', { threadId, turnId }).catch(() => undefined);
			fail(new Error('Codex run cancelled.'));
			this.close(rpc);
		};
		rpc.onClose = fail;
		rpc.onRequest = async (method, params) => {
			if (params.threadId !== threadId)
				throw new Error('Request does not belong to the active session.');
			context.signal.throwIfAborted();
			if (method === 'item/tool/requestUserInput') {
				const questions = params.questions as {
					id: string;
					question: string;
					options?: { label: string }[];
				}[];
				const response = await context.approve({
					toolName: 'request_user_input',
					input: params,
					kind: 'input',
					questions: questions.map((question) => ({
						id: question.id,
						question: question.question,
						options: question.options?.map((option) => option.label),
					})),
				});
				return {
					answers: Object.fromEntries(
						Object.entries(response.answers ?? {}).map(([id, answer]) => [
							id,
							{ answers: [answer] },
						])
					),
				};
			}
			if (
				method === 'item/commandExecution/requestApproval' ||
				method === 'item/fileChange/requestApproval' ||
				method === 'item/permissions/requestApproval'
			) {
				const response =
					context.settings.toolMode === 'read-only'
						? { approved: false }
						: await context.approve({ toolName: method.split('/')[1], input: params });
				if (method === 'item/permissions/requestApproval')
					return { permissions: response.approved ? params.permissions : {}, scope: 'turn' };
				return { decision: response.approved ? 'accept' : 'decline' };
			}
			throw new Error(`Unsupported Codex interaction: ${method}`);
		};
		rpc.onNotification = (method, params) => {
			if (params.threadId !== threadId) return;
			if (method === 'turn/started') turnId = (params.turn as { id: string }).id;
			if (method === 'item/agentMessage/delta') {
				const delta = String(params.delta ?? '');
				streamed.add(String(params.itemId));
				output += delta;
				context.emit({ type: 'text-delta', delta });
			} else if (method === 'item/reasoning/summaryTextDelta') {
				context.emit({ type: 'thinking-delta', delta: String(params.delta ?? '') });
			} else if (method === 'item/commandExecution/outputDelta') {
				context.emit({ type: 'command-output', delta: String(params.delta ?? '') });
			} else if (method === 'item/started' || method === 'item/completed') {
				const item = params.item as Item;
				const started = method === 'item/started';
				if (item.type === 'agentMessage' && !started && item.text && !streamed.has(item.id)) {
					output += item.text;
					context.emit({ type: 'text-delta', delta: item.text });
				} else if (item.type === 'commandExecution') {
					if (started) context.emit({ type: 'command-start', command: item.command ?? '' });
					else
						context.emit({
							type: 'command-end',
							exitCode: item.exitCode,
							cancelled: item.status === 'declined',
							truncated: false,
						});
				} else if (
					[
						'fileChange',
						'mcpToolCall',
						'dynamicToolCall',
						'collabToolCall',
						'webSearch',
						'imageView',
					].includes(item.type)
				) {
					if (started)
						context.emit({
							type: 'tool-start',
							toolCallId: item.id,
							toolName: item.tool ?? item.type,
						});
					else
						context.emit({
							type: 'tool-end',
							toolCallId: item.id,
							toolName: item.tool ?? item.type,
							isError:
								Boolean(item.error) || item.status === 'failed' || item.status === 'declined',
						});
				}
			} else if (method === 'turn/completed') {
				const turn = params.turn as { status: string; error?: { message: string } };
				if (turn.status === 'failed') fail(new Error(turn.error?.message ?? 'Codex run failed.'));
				else if (turn.status === 'interrupted') fail(new Error('Codex run cancelled.'));
				else finish();
			}
		};
		context.signal.addEventListener('abort', abort, { once: true });
		try {
			context.signal.throwIfAborted();
			await rpc.initialize();
			context.signal.throwIfAborted();
			const account = await rpc.request<{ account: unknown }>('account/read', {});
			const apiKey = this.getApiKey();
			if (!account.account && apiKey)
				await rpc.request('account/login/start', { type: 'apiKey', apiKey });
			const thread = await rpc.request<{ thread: { id: string } }>(
				context.nativeSessionId ? 'thread/resume' : 'thread/start',
				{
					...(context.nativeSessionId ? { threadId: context.nativeSessionId } : {}),
					cwd: context.cwd,
					model: context.settings.modelId || undefined,
					approvalPolicy: context.settings.toolMode === 'read-only' ? 'never' : 'on-request',
					approvalsReviewer: 'user',
					sandbox: context.settings.toolMode === 'read-only' ? 'read-only' : 'workspace-write',
				}
			);
			threadId = thread.thread.id;
			context.signal.throwIfAborted();
			const effort = context.settings.thinkingLevel;
			await rpc.request('turn/start', {
				threadId,
				input: [{ type: 'text', text: input, text_elements: [] }],
				effort: effort === 'off' ? 'none' : effort === 'max' ? 'xhigh' : effort,
			});
			await context.saveSession(threadId);
			await completion;
			return output;
		} finally {
			context.signal.removeEventListener('abort', abort);
			rpc.onClose = undefined;
			this.close(rpc);
		}
	}

	async listModels(): Promise<CodingCatalog> {
		const rpc = await this.open();
		try {
			await rpc.initialize();
			const account = await rpc.request<{ account: { type: string } | null }>('account/read', {});
			const models: CodingModel[] = [];
			let cursor: string | null = null;
			do {
				const page: { data: Model[]; nextCursor: string | null } = await rpc.request('model/list', {
					limit: 100,
					cursor,
				});
				models.push(
					...page.data.map((model) => ({
						id: model.model,
						name: model.displayName,
						reasoning: model.supportedReasoningEfforts.length > 0,
						contextWindow: 0,
					}))
				);
				cursor = page.nextCursor;
			} while (cursor);
			return {
				providers: [
					{
						id: 'openai-codex',
						name: 'OpenAI Codex',
						authentication: 'oauth',
						configured: Boolean(account.account || this.getApiKey()),
						authType: account.account?.type === 'chatgpt' ? 'oauth' : 'api_key',
						authSource: this.directory,
						models,
					},
				],
			};
		} finally {
			this.close(rpc);
		}
	}

	async connect(
		signal: AbortSignal,
		emit: (event: CodingAuthEvent) => void
	): Promise<CodingAuthStatus> {
		signal.throwIfAborted();
		const rpc = await this.open();
		let loginId: string | undefined;
		let complete!: () => void;
		let fail!: (error: Error) => void;
		const completion = new Promise<void>((resolve, reject) => {
			complete = resolve;
			fail = reject;
		});
		void completion.catch(() => undefined);
		rpc.onClose = fail;
		rpc.onNotification = (method, params) => {
			if (method === 'account/login/completed') {
				if (params.success) complete();
				else fail(new Error(String(params.error ?? 'Codex login failed.')));
			}
		};
		const abort = (): void => {
			if (loginId) void rpc.request('account/login/cancel', { loginId }).catch(() => undefined);
			fail(new Error('Codex login cancelled.'));
			this.close(rpc);
		};
		signal.addEventListener('abort', abort, { once: true });
		try {
			signal.throwIfAborted();
			await rpc.initialize();
			const apiKey = this.getApiKey();
			if (apiKey) {
				await rpc.request('account/login/start', { type: 'apiKey', apiKey });
				return { configured: true, type: 'api_key', source: this.directory };
			}
			const login = await rpc.request<{ loginId: string; authUrl: string }>('account/login/start', {
				type: 'chatgpt',
			});
			loginId = login.loginId;
			emit({
				type: 'auth-url',
				url: login.authUrl,
				instructions: 'Complete sign-in in your browser.',
			});
			await completion;
			return { configured: true, type: 'oauth', source: this.directory };
		} finally {
			signal.removeEventListener('abort', abort);
			rpc.onClose = undefined;
			this.close(rpc);
		}
	}

	async disconnect(): Promise<void> {
		const rpc = await this.open();
		try {
			await rpc.initialize();
			await rpc.request('account/logout', {});
		} finally {
			this.close(rpc);
		}
	}

	destroy(): void {
		for (const rpc of this.connections) rpc.close();
		this.connections.clear();
	}

	private async open(): Promise<CodexRpc> {
		await mkdir(this.directory, { recursive: true });
		const rpc = new CodexRpc(codexExecutable(), this.directory);
		this.connections.add(rpc);
		return rpc;
	}

	private close(rpc: CodexRpc): void {
		this.connections.delete(rpc);
		rpc.close();
	}
}
