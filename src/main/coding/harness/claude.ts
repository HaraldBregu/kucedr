import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { app } from 'electron';
import type { Options, Query, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { CodingCatalog } from '../../../shared/coding_types';
import type { CodingHarness, HarnessContext } from './types';

const READ_TOOLS = ['Read', 'Glob', 'Grep'];

export class ClaudeHarness implements CodingHarness {
	private readonly queries = new Set<Query>();

	constructor(
		private readonly directory: string,
		private readonly getApiKey: () => string | undefined
	) {}

	private executable(): string {
		const require = createRequire(join(app.getAppPath(), 'package.json'));
		const header = process.report?.getReport()?.header as
			| { glibcVersionRuntime?: string }
			| undefined;
		const suffix = process.platform === 'linux' && !header?.glibcVersionRuntime ? '-musl' : '';
		const binary = process.platform === 'win32' ? 'claude.exe' : 'claude';
		return require
			.resolve(
				`@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}${suffix}/${binary}`
			)
			.replace(/app\.asar([/\\])/, 'app.asar.unpacked$1');
	}

	private environment(): NodeJS.ProcessEnv {
		const env = { ...process.env };
		for (const key of Object.keys(env)) {
			if (key.startsWith('CLAUDE_') || key.startsWith('CLAUDECODE') || key.startsWith('ANTHROPIC_'))
				delete env[key];
		}
		return {
			...env,
			ANTHROPIC_API_KEY: this.getApiKey(),
			CLAUDE_CONFIG_DIR: this.directory,
			CLAUDE_AGENT_SDK_CLIENT_APP: 'kucedr-coder',
		};
	}

	async listModels(): Promise<CodingCatalog> {
		const configured = Boolean(this.getApiKey());
		const provider = {
			id: 'anthropic' as const,
			name: 'Anthropic',
			authentication: 'api-key' as const,
			configured,
		};
		if (!configured) return { providers: [{ ...provider, models: [] }] };
		await mkdir(this.directory, { recursive: true });
		const { query } = await import('@anthropic-ai/claude-agent-sdk');
		let release!: () => void;
		const stopped = new Promise<void>((resolve) => {
			release = resolve;
		});
		const prompt = (async function* (): AsyncGenerator<SDKUserMessage> {
			await stopped;
		})();
		const session = query({
			prompt,
			options: {
				cwd: this.directory,
				env: this.environment(),
				settingSources: [],
				tools: [],
				persistSession: false,
				pathToClaudeCodeExecutable: this.executable(),
			},
		});
		this.queries.add(session);
		try {
			const models = await session.supportedModels();
			return {
				providers: [
					{
						...provider,
						models: models.map((model) => ({
							id: model.value,
							name: model.displayName,
							reasoning: Boolean(model.supportsEffort || model.supportsAdaptiveThinking),
							contextWindow: 0,
						})),
					},
				],
			};
		} finally {
			release();
			session.close();
			this.queries.delete(session);
		}
	}

	async run(input: string, context: HarnessContext): Promise<string> {
		if (!this.getApiKey())
			throw new Error('Configure an Anthropic API key to use the Claude harness.');
		context.signal.throwIfAborted();
		await mkdir(this.directory, { recursive: true });
		let instructions = '';
		try {
			instructions = await readFile(join(context.cwd, 'CLAUDE.md'), 'utf8');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
		const { query } = await import('@anthropic-ai/claude-agent-sdk');
		context.signal.throwIfAborted();
		const abortController = new AbortController();
		const abort = (): void => abortController.abort(context.signal.reason);
		context.signal.addEventListener('abort', abort, { once: true });
		const readOnly = context.settings.toolMode === 'read-only';
		const level = context.settings.thinkingLevel;
		const effort: Options['effort'] = level === 'off' || level === 'minimal' ? 'low' : level;
		const options: Options = {
			cwd: context.cwd,
			pathToClaudeCodeExecutable: this.executable(),
			env: this.environment(),
			settingSources: [],
			systemPrompt: { type: 'preset', preset: 'claude_code', append: instructions },
			model: context.settings.modelId || undefined,
			effort,
			thinking: level === 'off' ? { type: 'disabled' } : undefined,
			resume: context.nativeSessionId,
			abortController,
			includePartialMessages: true,
			permissionMode: 'default',
			tools: readOnly ? READ_TOOLS : { type: 'preset', preset: 'claude_code' },
			allowedTools: READ_TOOLS,
			hooks: readOnly
				? {
						PreToolUse: [
							{
								hooks: [
									async (event) => {
										if (
											event.hook_event_name !== 'PreToolUse' ||
											READ_TOOLS.includes(event.tool_name)
										)
											return {};
										return {
											hookSpecificOutput: {
												hookEventName: 'PreToolUse',
												permissionDecision: 'deny',
												permissionDecisionReason: 'This Coder session is read-only.',
											},
										};
									},
								],
							},
						],
					}
				: undefined,
			canUseTool: async (toolName, toolInput) => {
				if (readOnly && !READ_TOOLS.includes(toolName))
					return { behavior: 'deny', message: 'This Coder session is read-only.' };
				const questions =
					toolName === 'AskUserQuestion' && Array.isArray(toolInput.questions)
						? toolInput.questions.map(
								(question: { question: string; options?: { label: string }[] }) => ({
									id: question.question,
									question: question.question,
									options: question.options?.map((option) => option.label),
								})
							)
						: undefined;
				const result = await context.approve({
					toolName,
					input: toolInput,
					kind: questions ? 'input' : 'approval',
					questions,
				});
				if (!result.approved)
					return { behavior: 'deny', message: 'The user declined this operation.' };
				return {
					behavior: 'allow',
					updatedInput: questions ? { ...toolInput, answers: result.answers ?? {} } : toolInput,
				};
			},
		};
		let session: Query | undefined;
		let output = '';
		let nativeId = context.nativeSessionId;
		let messageStreamed = false;
		const toolNames = new Map<string, string>();
		try {
			session = query({ prompt: input, options });
			this.queries.add(session);
			for await (const message of session) {
				context.signal.throwIfAborted();
				if ('session_id' in message && message.session_id && message.session_id !== nativeId) {
					nativeId = message.session_id;
					await context.saveSession(nativeId);
				}
				if (message.type === 'stream_event' && !message.parent_tool_use_id) {
					const event = message.event;
					if (event.type === 'message_start') messageStreamed = false;
					if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
						messageStreamed = true;
						output += event.delta.text;
						context.emit({ type: 'text-delta', delta: event.delta.text });
					} else if (
						event.type === 'content_block_delta' &&
						event.delta.type === 'thinking_delta'
					) {
						context.emit({ type: 'thinking-delta', delta: event.delta.thinking });
					}
				} else if (message.type === 'assistant') {
					for (const block of message.message.content) {
						if (block.type === 'tool_use') {
							toolNames.set(block.id, block.name);
							context.emit({ type: 'tool-start', toolCallId: block.id, toolName: block.name });
						} else if (block.type === 'text' && !message.parent_tool_use_id && !messageStreamed) {
							output += block.text;
							context.emit({ type: 'text-delta', delta: block.text });
						}
					}
				} else if (message.type === 'user' && Array.isArray(message.message.content)) {
					for (const block of message.message.content) {
						if (block.type !== 'tool_result') continue;
						context.emit({
							type: 'tool-end',
							toolCallId: block.tool_use_id,
							toolName: toolNames.get(block.tool_use_id) ?? 'Tool',
							isError: Boolean(block.is_error),
						});
						toolNames.delete(block.tool_use_id);
					}
				} else if (message.type === 'result') {
					if (message.subtype !== 'success')
						throw new Error(message.errors.join('\n') || 'Claude could not complete this run.');
					if (message.is_error)
						throw new Error(message.result || 'Claude could not complete this run.');
					if (!output && message.result) {
						output = message.result;
						context.emit({ type: 'text-delta', delta: output });
					}
				}
			}
			return output;
		} finally {
			context.signal.removeEventListener('abort', abort);
			session?.close();
			if (session) this.queries.delete(session);
		}
	}

	destroy(): void {
		for (const query of this.queries) query.close();
		this.queries.clear();
	}
}
