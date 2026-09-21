import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type {
	FunctionTool,
	ResponseCreateParamsStreaming,
	ResponseFunctionToolCall,
	ResponseStreamEvent,
} from 'openai/resources/responses/responses';
import type { LlmEvent, LlmRequest, LlmResponse } from './llm_types';
import type {
	LlmAdapter,
	LlmProviderEvent,
	LlmProviderSpec,
	LlmStreamRequest,
	LlmUsage,
} from './llm_types';
import { LlmContextOverflowError, LlmProviderAuthError } from './llm_types';
import { anthropic as completeAnthropic } from './anthropic';
import { chat as completeChat } from './chat';
import { responses as completeResponses } from './responses';
import {
	llmBuildAnthropicMessages,
	llmBuildChatMessages,
	llmBuildResponseInput,
	llmHasFunctionCall,
	llmIsRecord,
	llmParseToolArgs,
	llmToDeepSeekReasoningEffort,
	llmToTranscriptEntry,
} from './llm_shared';

type LlmModelFactory = (provider: LlmProviderSpec) => LlmAdapter;

interface LlmClientFactoryInput {
	apiKey: string;
	baseURL?: string;
}

export interface LlmModelOptions {
	provider?: LlmProviderSpec;
	providerModelFactory?: LlmModelFactory;
	openAIClientFactory?: (opts: LlmClientFactoryInput) => OpenAI;
	anthropicClientFactory?: (opts: LlmClientFactoryInput) => Anthropic;
	reasoningEffortEnabled?: boolean;
	reasoningContentEnabled?: boolean;
	thinkingModeEnabled?: boolean;
}

interface ResponseToolCallState {
	id: string;
	name: string;
	argsStr: string;
	emittedStart: boolean;
	emittedEnd: boolean;
}

interface ChatToolCallState {
	id: string;
	name: string;
	argsStr: string;
	emittedStart: boolean;
}

export class LlmModel implements LlmAdapter {
	private readonly provider?: LlmProviderSpec;
	private readonly providerModelFactory?: LlmModelFactory;
	private readonly openAIClientFactory?: (opts: LlmClientFactoryInput) => OpenAI;
	private readonly anthropicClientFactory?: (opts: LlmClientFactoryInput) => Anthropic;
	private readonly reasoningEffortEnabled: boolean;
	private readonly reasoningContentEnabled: boolean;
	private readonly thinkingModeEnabled: boolean;

	constructor(options: LlmModelOptions = {}) {
		this.provider = options.provider;
		this.providerModelFactory = options.providerModelFactory;
		this.openAIClientFactory = options.openAIClientFactory;
		this.anthropicClientFactory = options.anthropicClientFactory;
		this.reasoningEffortEnabled = options.reasoningEffortEnabled ?? false;
		this.reasoningContentEnabled = options.reasoningContentEnabled ?? false;
		this.thinkingModeEnabled = options.thinkingModeEnabled ?? false;
	}

	async generate(request: LlmRequest): Promise<LlmResponse> {
		let content = '';
		const toolCalls = new Map<string, { name: string; argsText: string }>();
		let stopReason: string | undefined;
		let usage: LlmResponse['usage'];

		for await (const event of this.stream(request)) {
			if (event.type === 'model_call_delta') {
				content += event.delta;
			}
			if (event.type === 'model_tool_call_start') {
				toolCalls.set(event.id, { name: event.name, argsText: '' });
			}
			if (event.type === 'model_tool_call_args_delta') {
				const toolCall = toolCalls.get(event.id);
				if (toolCall) toolCall.argsText += event.jsonDelta;
			}
			if (event.type === 'model_call_end') {
				stopReason = event.stopReason;
				usage = event.usage;
			}
		}

		return {
			content,
			toolCalls: [...toolCalls].map(([id, toolCall]) => ({
				id,
				name: toolCall.name,
				args: llmParseToolArgs(toolCall.argsText),
			})),
			model: request.model,
			stopReason,
			usage,
		};
	}

	stream(request: LlmRequest): AsyncIterable<LlmEvent>;
	stream(request: LlmStreamRequest): AsyncIterable<LlmProviderEvent>;
	async *stream(
		request: LlmRequest | LlmStreamRequest
	): AsyncIterable<LlmEvent | LlmProviderEvent> {
		if (isLlmRequest(request)) {
			yield* this.streamAgent(request);
			return;
		}

		yield* this.streamProvider(request);
	}

	private async *streamAgent(request: LlmRequest): AsyncIterable<LlmEvent> {
		const system = [
			request.systemPrompt,
			...request.messages
				.filter((message) => message.role === 'system')
				.map((message) => message.content),
		]
			.filter(Boolean)
			.join('\n\n');
		const messages = request.messages.filter((message) => message.role !== 'system');

		yield { type: 'model_call_start', model: request.model, effort: request.effort };

		for await (const event of this.createProviderModel(request.provider).stream({
			model: request.model,
			effort: request.effort,
			options: request.options,
			system,
			messages: messages.flatMap(llmToTranscriptEntry),
			tools: (request.tools ?? []).map((tool) => ({
				name: tool.id,
				description: tool.description ?? '',
				schema: tool.schema ?? { type: 'object', properties: {}, additionalProperties: true },
			})),
			maxTokens: request.maxTokens,
			signal: request.signal,
			streaming: request.streaming,
		})) {
			if (event.type === 'text_delta') {
				yield { type: 'model_call_delta', delta: event.text };
			}
			if (event.type === 'reasoning_item' && event.provider === 'openai' && event.item) {
				yield { type: 'model_provider_item', provider: 'openai', item: event.item };
			}
			if (event.type === 'tool_call_start') {
				yield { type: 'model_tool_call_start', id: event.id, name: event.name };
			}
			if (event.type === 'tool_call_args_delta') {
				yield {
					type: 'model_tool_call_args_delta',
					id: event.id,
					jsonDelta: event.jsonDelta,
				};
			}
			if (event.type === 'tool_call_end') {
				yield { type: 'model_tool_call_end', id: event.id };
			}
			if (event.type === 'message_end') {
				yield {
					type: 'model_call_end',
					model: request.model,
					stopReason: event.stopReason,
					usage: event.usage,
				};
			}
		}
	}

	private createProviderModel(provider: LlmProviderSpec): LlmAdapter {
		if (this.providerModelFactory) return this.providerModelFactory(provider);
		return new LlmModel({
			provider,
			openAIClientFactory: this.openAIClientFactory,
			anthropicClientFactory: this.anthropicClientFactory,
			reasoningEffortEnabled: this.reasoningEffortEnabled,
			reasoningContentEnabled: this.reasoningContentEnabled,
			thinkingModeEnabled: this.thinkingModeEnabled,
		});
	}

	private async *streamProvider(req: LlmStreamRequest): AsyncIterable<LlmProviderEvent> {
		const provider = this.provider;
		if (!provider) throw new Error('LlmModel requires a provider for LLM streaming.');

		const id = provider.id.toLowerCase();
		if (id === 'anthropic') {
			yield* this.streamAnthropic(provider, req);
			return;
		}
		if (id === 'openai') {
			yield* this.streamOpenAIResponses(provider, req);
			return;
		}
		yield* this.streamOpenAIChat(provider, req);
	}

	private async *streamOpenAIResponses(
		provider: LlmProviderSpec,
		req: LlmStreamRequest
	): AsyncIterable<LlmProviderEvent> {
		const client = this.createOpenAIClient(provider, 'OpenAI api key not configured');
		if (req.streaming === false) {
			try {
				yield* completeResponses(client, req);
			} catch (error) {
				this.throwProviderError(error);
			}
			return;
		}
		const tools: FunctionTool[] = req.tools.map((tool) => ({
			type: 'function',
			name: tool.name,
			description: tool.description,
			parameters: tool.schema as Record<string, unknown>,
			strict: false,
		}));
		const responseOptions = req.options as Partial<ResponseCreateParamsStreaming> | undefined;
		const configuredReasoning = responseOptions?.reasoning;

		const params: ResponseCreateParamsStreaming = {
			...responseOptions,
			model: req.model,
			instructions: req.system || undefined,
			input:
				(req.inputItems as ResponseCreateParamsStreaming['input']) ??
				llmBuildResponseInput(req.messages),
			previous_response_id: req.previousResponseId,
			tools: tools.length > 0 ? tools : undefined,
			reasoning: req.effort
				? { ...(configuredReasoning ?? {}), effort: req.effort }
				: configuredReasoning,
			max_output_tokens: req.maxTokens,
			include: ['reasoning.encrypted_content'],
			stream: true,
		};

		yield { type: 'message_start' };

		const usage: LlmUsage = { inputTokens: 0, outputTokens: 0 };
		let stopReason = 'end_turn';
		const callsByOutputIndex = new Map<number, ResponseToolCallState>();

		const emitToolStart = function* (state: ResponseToolCallState): Iterable<LlmProviderEvent> {
			if (state.emittedStart) return;
			if (!state.id || !state.name) return;
			state.emittedStart = true;
			yield { type: 'tool_call_start', id: state.id, name: state.name };
		};

		const emitToolEnd = function* (state: ResponseToolCallState): Iterable<LlmProviderEvent> {
			if (state.emittedEnd || !state.emittedStart) return;
			state.emittedEnd = true;
			yield { type: 'tool_call_end', id: state.id };
		};

		const stateFor = (
			outputIndex: number,
			fallbackId: string,
			fallbackName = '',
			preferId = false
		): ResponseToolCallState => {
			let state = callsByOutputIndex.get(outputIndex);
			if (!state) {
				state = {
					id: fallbackId,
					name: fallbackName,
					argsStr: '',
					emittedStart: false,
					emittedEnd: false,
				};
				callsByOutputIndex.set(outputIndex, state);
			}
			if (fallbackId && (preferId || !state.id)) state.id = fallbackId;
			if (fallbackName) state.name = fallbackName;
			return state;
		};

		try {
			const stream = await client.responses.create(params, { signal: req.signal });
			for await (const event of stream) {
				for (const providerEvent of this.adaptOpenAIResponseEvent(
					event,
					usage,
					stateFor,
					emitToolStart,
					emitToolEnd,
					(stop) => {
						stopReason = stop;
					}
				)) {
					yield providerEvent;
				}
			}
		} catch (err) {
			this.throwProviderError(err);
		}

		for (const state of callsByOutputIndex.values()) {
			for (const providerEvent of emitToolEnd(state)) yield providerEvent;
		}

		yield { type: 'message_end', stopReason, usage };
	}

	private *adaptOpenAIResponseEvent(
		event: ResponseStreamEvent,
		usage: LlmUsage,
		stateFor: (
			outputIndex: number,
			fallbackId: string,
			fallbackName?: string,
			preferId?: boolean
		) => ResponseToolCallState,
		emitToolStart: (state: ResponseToolCallState) => Iterable<LlmProviderEvent>,
		emitToolEnd: (state: ResponseToolCallState) => Iterable<LlmProviderEvent>,
		setStopReason: (stopReason: string) => void
	): Iterable<LlmProviderEvent> {
		switch (event.type) {
			case 'response.created':
				yield { type: 'response_created', id: event.response.id };
				break;
			case 'response.output_item.added': {
				if (event.item.type !== 'function_call') break;
				const item = event.item as ResponseFunctionToolCall;
				const state = stateFor(event.output_index, item.call_id, item.name, true);
				for (const providerEvent of emitToolStart(state)) yield providerEvent;
				break;
			}
			case 'response.function_call_arguments.delta': {
				const state = stateFor(event.output_index, event.item_id);
				for (const providerEvent of emitToolStart(state)) yield providerEvent;
				state.argsStr += event.delta;
				if (state.id) {
					yield {
						type: 'tool_call_args_delta',
						id: state.id,
						jsonDelta: event.delta,
					};
				}
				break;
			}
			case 'response.function_call_arguments.done': {
				const state = stateFor(event.output_index, event.item_id, event.name);
				for (const providerEvent of emitToolStart(state)) yield providerEvent;
				if (!state.argsStr && event.arguments) {
					state.argsStr = event.arguments;
					yield {
						type: 'tool_call_args_delta',
						id: state.id,
						jsonDelta: event.arguments,
					};
				}
				for (const providerEvent of emitToolEnd(state)) yield providerEvent;
				break;
			}
			case 'response.output_item.done': {
				if (event.item.type === 'reasoning') {
					yield { type: 'reasoning_item', provider: 'openai', item: event.item };
					break;
				}
				if (event.item.type === 'mcp_approval_request') {
					yield {
						type: 'mcp_approval_request',
						id: event.item.id,
						serverLabel: event.item.server_label,
						name: event.item.name,
						arguments: event.item.arguments,
						item: event.item,
					};
					setStopReason('end_turn');
					break;
				}
				if (event.item.type === 'mcp_list_tools') {
					yield {
						type: 'mcp_list_tools',
						serverLabel: event.item.server_label,
						item: event.item,
						tools: event.item.tools.map((tool) => ({
							name: tool.name,
							description: tool.description ?? undefined,
							inputSchema: llmIsRecord(tool.input_schema) ? tool.input_schema : undefined,
						})),
					};
					break;
				}
				if (event.item.type === 'mcp_call') {
					yield {
						type: 'mcp_call',
						id: event.item.id,
						serverLabel: event.item.server_label,
						name: event.item.name,
						arguments: event.item.arguments,
						output: event.item.output ?? undefined,
						error: event.item.error ?? undefined,
						status: event.item.status,
						item: event.item,
					};
					break;
				}
				if (event.item.type !== 'function_call') break;
				const item = event.item as ResponseFunctionToolCall;
				const state = stateFor(event.output_index, item.call_id, item.name, true);
				for (const providerEvent of emitToolStart(state)) yield providerEvent;
				if (!state.argsStr && item.arguments) {
					state.argsStr = item.arguments;
					yield {
						type: 'tool_call_args_delta',
						id: state.id,
						jsonDelta: item.arguments,
					};
				}
				for (const providerEvent of emitToolEnd(state)) yield providerEvent;
				break;
			}
			case 'response.output_text.delta':
			case 'response.refusal.delta':
				yield { type: 'text_delta', text: event.delta };
				break;
			case 'response.mcp_call_arguments.delta':
			case 'response.mcp_call_arguments.done':
			case 'response.mcp_call.completed':
			case 'response.mcp_call.failed':
			case 'response.mcp_call.in_progress':
			case 'response.mcp_list_tools.completed':
			case 'response.mcp_list_tools.failed':
			case 'response.mcp_list_tools.in_progress':
				break;
			case 'response.completed':
				usage.inputTokens = event.response.usage?.input_tokens ?? usage.inputTokens;
				usage.outputTokens = event.response.usage?.output_tokens ?? usage.outputTokens;
				setStopReason(llmHasFunctionCall(event.response.output) ? 'tool_calls' : 'end_turn');
				break;
			case 'response.incomplete':
				usage.inputTokens = event.response.usage?.input_tokens ?? usage.inputTokens;
				usage.outputTokens = event.response.usage?.output_tokens ?? usage.outputTokens;
				setStopReason(
					event.response.incomplete_details?.reason === 'max_output_tokens'
						? 'max_tokens'
						: 'incomplete'
				);
				break;
			case 'response.failed':
				throw new Error(event.response.error?.message ?? 'OpenAI response failed.');
			case 'error':
				throw new Error(event.message);
		}
	}

	private async *streamAnthropic(
		provider: LlmProviderSpec,
		req: LlmStreamRequest
	): AsyncIterable<LlmProviderEvent> {
		const client = this.createAnthropicClient(provider);
		if (req.streaming === false) {
			try {
				yield* completeAnthropic(client, req);
			} catch (error) {
				this.throwProviderError(error);
			}
			return;
		}
		const tools: Anthropic.Messages.Tool[] = req.tools.map((t) => ({
			name: t.name,
			description: t.description,
			input_schema: t.schema as Anthropic.Messages.Tool.InputSchema,
		}));

		yield { type: 'message_start' };

		const usage = { inputTokens: 0, outputTokens: 0 };
		let stopReason = 'end_turn';
		const blockIndexToToolUseId = new Map<number, string>();

		try {
			const stream = client.messages.stream(
				{
					...req.options,
					model: req.model,
					system: req.system,
					max_tokens: req.maxTokens,
					tools: tools.length > 0 ? tools : undefined,
					messages: llmBuildAnthropicMessages(req.messages),
				},
				{ signal: req.signal }
			);

			for await (const rawEvent of stream) {
				if (!rawEvent || typeof rawEvent !== 'object') continue;
				const event = rawEvent as Anthropic.Messages.RawMessageStreamEvent;
				if (event.type === 'content_block_start') {
					if (event.content_block.type === 'tool_use') {
						blockIndexToToolUseId.set(event.index, event.content_block.id);
						yield {
							type: 'tool_call_start',
							id: event.content_block.id,
							name: event.content_block.name,
						};
					}
				} else if (event.type === 'content_block_delta') {
					const delta = event.delta;
					if (delta.type === 'text_delta') {
						yield { type: 'text_delta', text: delta.text };
					} else if (delta.type === 'input_json_delta') {
						const id = blockIndexToToolUseId.get(event.index) ?? '';
						yield { type: 'tool_call_args_delta', id, jsonDelta: delta.partial_json };
					}
				} else if (event.type === 'content_block_stop') {
					const id = blockIndexToToolUseId.get(event.index);
					if (id) yield { type: 'tool_call_end', id };
				} else if (event.type === 'message_delta') {
					if (event.delta.stop_reason) stopReason = event.delta.stop_reason;
					if (event.usage) usage.outputTokens = event.usage.output_tokens ?? usage.outputTokens;
				} else if (event.type === 'message_start') {
					if (event.message.usage) {
						usage.inputTokens = event.message.usage.input_tokens ?? usage.inputTokens;
						usage.outputTokens = event.message.usage.output_tokens ?? usage.outputTokens;
					}
				}
			}
		} catch (err) {
			this.throwProviderError(err);
		}

		yield { type: 'message_end', stopReason, usage };
	}

	private async *streamOpenAIChat(
		provider: LlmProviderSpec,
		req: LlmStreamRequest
	): AsyncIterable<LlmProviderEvent> {
		const client = this.createOpenAIClient(provider, 'API key not configured');
		if (req.streaming === false) {
			try {
				yield* completeChat(client, req, {
					reasoningContentEnabled: this.reasoningContentEnabled,
					reasoningEffortEnabled: this.reasoningEffortEnabled,
					thinkingModeEnabled: this.thinkingModeEnabled,
					contentProfile: provider.id.toLowerCase() === 'reka' ? 'reka' : 'image-only',
				});
			} catch (error) {
				this.throwProviderError(error);
			}
			return;
		}
		const tools: OpenAI.ChatCompletionTool[] = req.tools.map((t) => ({
			type: 'function' as const,
			function: {
				name: t.name,
				description: t.description,
				parameters: t.schema as Record<string, unknown>,
			},
		}));

		yield { type: 'message_start' };

		const usage: LlmUsage = { inputTokens: 0, outputTokens: 0 };
		let stopReason = 'end_turn';
		const pending = new Map<number, ChatToolCallState>();

		try {
			const params: Record<string, unknown> = {
				...req.options,
				model: req.model,
				messages: llmBuildChatMessages(req.system, req.messages, {
					includeReasoningContent: this.reasoningContentEnabled,
					contentProfile: provider.id.toLowerCase() === 'reka' ? 'reka' : 'image-only',
				}),
				tools: tools.length > 0 ? tools : undefined,
				tool_choice: tools.length > 0 ? 'auto' : undefined,
				max_tokens: req.maxTokens,
				stream: true,
				stream_options: { include_usage: true },
			};
			if (this.thinkingModeEnabled) {
				params.thinking = { type: req.effort === 'none' ? 'disabled' : 'enabled' };
			}
			if (this.reasoningEffortEnabled) {
				const reasoningEffort = llmToDeepSeekReasoningEffort(req.effort);
				if (reasoningEffort) params.reasoning_effort = reasoningEffort;
			}
			const stream = await client.chat.completions.create(
				params as unknown as OpenAI.Chat.ChatCompletionCreateParamsStreaming,
				{ signal: req.signal }
			);

			for await (const chunk of stream) {
				if (chunk.usage) {
					usage.inputTokens = chunk.usage.prompt_tokens ?? usage.inputTokens;
					usage.outputTokens = chunk.usage.completion_tokens ?? usage.outputTokens;
				}

				const choice = chunk.choices?.[0];
				if (!choice) continue;

				const delta = choice.delta;

				const reasoningContent = (delta as { reasoning_content?: unknown }).reasoning_content;
				if (
					this.reasoningContentEnabled &&
					typeof reasoningContent === 'string' &&
					reasoningContent.length > 0
				) {
					yield { type: 'reasoning_item', provider: 'deepseek', item: reasoningContent };
				}

				if (delta.content) {
					yield { type: 'text_delta', text: delta.content };
				}

				if (delta.tool_calls) {
					for (const tc of delta.tool_calls) {
						let state = pending.get(tc.index);
						if (!state) {
							state = {
								id: tc.id ?? '',
								name: tc.function?.name ?? '',
								argsStr: '',
								emittedStart: false,
							};
							pending.set(tc.index, state);
						}
						if (tc.id) state.id = tc.id;
						if (tc.function?.name) state.name = tc.function.name;
						if (!state.emittedStart && state.id && state.name) {
							state.emittedStart = true;
							yield { type: 'tool_call_start', id: state.id, name: state.name };
						}
						if (tc.function?.arguments) {
							state.argsStr += tc.function.arguments;
							yield {
								type: 'tool_call_args_delta',
								id: state.id,
								jsonDelta: tc.function.arguments,
							};
						}
					}
				}

				if (choice.finish_reason) {
					stopReason =
						choice.finish_reason === 'tool_calls'
							? 'tool_calls'
							: choice.finish_reason === 'length'
								? 'max_tokens'
								: 'end_turn';
				}
			}
		} catch (err) {
			this.throwProviderError(err);
		}

		for (const state of pending.values()) {
			if (state.emittedStart) yield { type: 'tool_call_end', id: state.id };
		}

		yield { type: 'message_end', stopReason, usage };
	}

	private createOpenAIClient(provider: LlmProviderSpec, missingKeyMessage: string): OpenAI {
		if (!provider.apiKey) throw new LlmProviderAuthError(missingKeyMessage);
		const factory =
			this.openAIClientFactory ?? ((c) => new OpenAI({ apiKey: c.apiKey, baseURL: c.baseURL }));
		return factory({ apiKey: provider.apiKey, baseURL: llmBaseUrl(provider) });
	}

	private createAnthropicClient(provider: LlmProviderSpec): Anthropic {
		if (!provider.apiKey) throw new LlmProviderAuthError('Anthropic api key not configured');
		const factory =
			this.anthropicClientFactory ??
			((c) => new Anthropic({ apiKey: c.apiKey, baseURL: c.baseURL }));
		return factory({ apiKey: provider.apiKey, baseURL: provider.baseURL });
	}

	private throwProviderError(err: unknown): never {
		const status = (err as { status?: number }).status ?? 0;
		const msg = (err as Error).message ?? String(err);
		if (status === 401 || status === 403) throw new LlmProviderAuthError(msg);
		if (/context|too long|max.*tokens|exceed/i.test(msg)) {
			throw new LlmContextOverflowError(msg);
		}
		throw err;
	}
}

function isLlmRequest(request: LlmRequest | LlmStreamRequest): request is LlmRequest {
	return 'provider' in request;
}

function llmBaseUrl(provider: LlmProviderSpec): string | undefined {
	if (!['custom', 'ollama'].includes(provider.id.toLowerCase()) || !provider.baseURL)
		return provider.baseURL;
	return new URL('/v1', provider.baseURL).toString();
}
