import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	Agent,
	completeClineDeviceAuth,
	createBuiltinTools,
	getValidClineCredentials,
	peekClineRecommendedModels,
	startClineDeviceAuth,
} from '@cline/sdk';
import type {
	CodingAuthEvent,
	CodingAuthStatus,
	CodingCatalog,
	CodingModel,
} from '../../../shared/coding_types';
import type { CodingHarness, HarnessContext } from './types';

const CLINE_API_URL = 'https://api.cline.bot';
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Credentials = {
	access: string;
	refresh: string;
	expires: number;
	accountId?: string;
	email?: string;
	metadata?: Record<string, unknown>;
};
type AgentMessage = Parameters<Agent['restore']>[0][number];

export class ClineHarness implements CodingHarness {
	private readonly active = new Set<Agent>();

	constructor(
		private readonly directory: string,
		private readonly getCredential: () => string | undefined,
		private readonly saveCredential: (value: string | undefined) => Promise<void>
	) {}

	async run(input: string, context: HarnessContext): Promise<string> {
		context.signal.throwIfAborted();
		const apiKey = await this.token();
		if (!apiKey) throw new Error('Connect your Cline account in Coder settings.');
		const sessionId = context.nativeSessionId ?? randomUUID();
		if (!SESSION_ID.test(sessionId)) throw new Error('Invalid Cline session ID.');
		const path = join(this.directory, 'sessions', `${sessionId}.json`);
		const messages: AgentMessage[] = context.nativeSessionId
			? JSON.parse(await readFile(path, 'utf8'))
			: [];
		const coding = context.settings.toolMode === 'coding';
		const tools = createBuiltinTools({
			cwd: context.cwd,
			executorOptions: {
				editor: { restrictToCwd: true },
				applyPatch: { restrictToCwd: true },
			},
			enableReadFiles: true,
			enableSearch: true,
			enableBash: coding,
			enableApplyPatch: coding,
			enableEditor: coding,
			enableWebFetch: false,
			enableSkills: false,
			enableAskQuestion: false,
			enableSubmitAndExit: false,
		});
		const agent = new Agent({
			providerId: 'cline',
			modelId: context.settings.modelId,
			apiKey,
			sessionId,
			thinking: context.settings.thinkingLevel !== 'off',
			...(context.settings.thinkingLevel !== 'off'
				? { reasoningEffort: context.settings.thinkingLevel }
				: {}),
			initialMessages: messages,
			maxIterations: 32,
			systemPrompt: `You are a coding assistant. Work in ${context.cwd}.`,
			tools,
			toolPolicies: Object.fromEntries(
				tools.map((tool) => [
					tool.name,
					{ autoApprove: tool.name === 'read_files' || tool.name === 'search_codebase' },
				])
			),
			requestToolApproval: async (request) => {
				context.signal.throwIfAborted();
				return context.approve({ toolName: request.toolName, input: request.input });
			},
		});
		const abort = (): void => agent.abort(context.signal.reason);
		context.signal.addEventListener('abort', abort, { once: true });
		this.active.add(agent);
		const unsubscribe = agent.subscribe((event) => {
			if (event.type === 'assistant-text-delta')
				context.emit({ type: 'text-delta', delta: event.text });
			else if (event.type === 'assistant-reasoning-delta')
				context.emit({ type: 'thinking-delta', delta: event.text });
			else if (event.type === 'tool-started')
				context.emit({
					type: 'tool-start',
					toolCallId: event.toolCall.toolCallId,
					toolName: event.toolCall.toolName,
				});
			else if (event.type === 'tool-finished')
				context.emit({
					type: 'tool-end',
					toolCallId: event.toolCall.toolCallId,
					toolName: event.toolCall.toolName,
					isError: event.message.content.some(
						(part) => part.type === 'tool-result' && Boolean(part.isError)
					),
				});
		});
		try {
			context.signal.throwIfAborted();
			const result = await agent.run(input);
			if (result.status === 'aborted' || context.signal.aborted)
				throw new Error('Cline run cancelled.');
			if (result.status === 'failed') throw result.error ?? new Error('Cline run failed.');
			await mkdir(join(this.directory, 'sessions'), { recursive: true });
			const temporary = `${path}.${randomUUID()}.tmp`;
			await writeFile(temporary, JSON.stringify(result.messages), { mode: 0o600 });
			await rename(temporary, path);
			await context.saveSession(sessionId);
			return result.outputText;
		} finally {
			unsubscribe();
			context.signal.removeEventListener('abort', abort);
			this.active.delete(agent);
		}
	}

	async listModels(): Promise<CodingCatalog> {
		const recommended = peekClineRecommendedModels();
		const models: CodingModel[] = [...recommended.recommended, ...recommended.free].map(
			(model) => ({
				id: model.id,
				name: model.name,
				reasoning: false,
				contextWindow: 0,
			})
		);
		const configured = Boolean(this.getCredential());
		return {
			providers: [
				{
					id: 'cline',
					name: 'Cline',
					authentication: 'oauth',
					configured,
					authType: this.storedCredentials() ? 'oauth' : 'api_key',
					authSource: this.directory,
					models,
				},
			],
		};
	}

	async connect(
		signal: AbortSignal,
		emit: (event: CodingAuthEvent) => void
	): Promise<CodingAuthStatus> {
		signal.throwIfAborted();
		const device = await startClineDeviceAuth();
		signal.throwIfAborted();
		emit({
			type: 'device-code',
			userCode: device.userCode,
			verificationUri: device.verificationUriComplete ?? device.verificationUri,
			expiresInSeconds: device.expiresInSeconds,
		});
		const completion = completeClineDeviceAuth({
			deviceCode: device.deviceCode,
			expiresInSeconds: device.expiresInSeconds,
			pollIntervalSeconds: device.pollIntervalSeconds,
			apiBaseUrl: CLINE_API_URL,
			provider: 'cline',
		});
		const credentials = await new Promise<Credentials>((resolve, reject) => {
			const abort = (): void => reject(new Error('Cline sign-in cancelled.'));
			signal.addEventListener('abort', abort, { once: true });
			void completion.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
		});
		signal.throwIfAborted();
		await this.saveCredential(JSON.stringify(credentials));
		return { configured: true, type: 'oauth', source: this.directory };
	}

	async disconnect(): Promise<void> {
		await this.saveCredential(undefined);
	}

	async deleteSession(id: string): Promise<void> {
		if (!SESSION_ID.test(id)) throw new Error('Invalid Cline session ID.');
		await rm(join(this.directory, 'sessions', `${id}.json`), { force: true });
	}

	destroy(): void {
		for (const agent of this.active) agent.abort();
		this.active.clear();
	}

	private storedCredentials(): Credentials | undefined {
		const raw = this.getCredential();
		if (!raw?.startsWith('{')) return undefined;
		try {
			const value = JSON.parse(raw) as Partial<Credentials>;
			if (
				typeof value.access === 'string' &&
				typeof value.refresh === 'string' &&
				typeof value.expires === 'number'
			)
				return value as Credentials;
		} catch {
			return undefined;
		}
		return undefined;
	}

	private async token(): Promise<string | undefined> {
		const raw = this.getCredential();
		const credentials = this.storedCredentials();
		if (!credentials) {
			if (raw?.startsWith('{')) throw new Error('Cline account credentials are invalid. Sign in again.');
			return raw;
		}
		const valid = await getValidClineCredentials(credentials, { apiBaseUrl: CLINE_API_URL });
		if (!valid) {
			await this.saveCredential(undefined);
			return undefined;
		}
		if (valid.access !== credentials.access || valid.expires !== credentials.expires)
			await this.saveCredential(JSON.stringify(valid));
		return valid.access;
	}
}
