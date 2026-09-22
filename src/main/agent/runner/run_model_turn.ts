import { LlmContextOverflowError, LlmModel } from '../../models/adapters/llm';
import type { LlmEvent, LlmRequest } from '../../models/adapters/llm';
import { parseToolArgs } from '../../shared/parse_tool_args';
import type { ResolvedProvider } from '../../../shared/provider_types';
import type { Message, MessageContentBlock, RuntimeEvent, RuntimeInput, Tool } from '../types';
import type { ModelTurn } from './run_loop_types';
import { setTimeout as wait } from 'node:timers/promises';
import { isTransientModelError } from './run_is_transient_model_error';
import { modelOutputLimit } from './run_model_output_limit';
import { modelInputLimit } from './run_model_input_limit';
import { fitModelContext } from './run_model_context_budget';
import type { KeyedLimiter } from '../limiter';
import type { ExecutionBudget } from '../execution/budget';
import { retryAfterMs } from './run_retry_after';

export interface ModelTurnStream {
	stream(request: LlmRequest): AsyncIterable<LlmEvent>;
}

const llmModel = new LlmModel();

export async function* runModelTurn(
	input: RuntimeInput,
	provider: ResolvedProvider,
	modelId: string,
	systemPrompt: string | undefined,
	messages: Message[],
	tools: Tool[],
	signal: AbortSignal,
	modelOptions: Record<string, unknown> = {},
	llm: ModelTurnStream = llmModel,
	protectedSystemPrompt = '',
	contextMessages: Message[] = [],
	streaming = true,
	providerLimiter?: KeyedLimiter,
	onContextAccepted?: () => void,
	budget?: ExecutionBudget
): AsyncGenerator<RuntimeEvent, ModelTurn> {
	const maxRetries = 2;
	const maxTokens = modelOutputLimit(provider.id, modelId, modelOptions);
	const context = fitModelContext({
		systemPrompt,
		protectedSystemPrompt,
		contextMessages,
		messages,
		tools,
		maxInputTokens: modelInputLimit(provider.id, modelId, maxTokens),
	});
	onContextAccepted?.();
	for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
		const attemptStartedAt = Date.now();
		let firstTokenAt: number | undefined;
		let visibleOutput = false;
		let content = '';
		let model = modelId;
		let stopReason: string | undefined;
		let usage: ModelTurn['usage'];
		const providerItems: MessageContentBlock[] = [];
		const pending = new Map<string, { name: string; argsText: string }>();
		const lease = providerLimiter
			? await providerLimiter.acquire(provider.id.trim().toLowerCase(), signal)
			: undefined;
		let retryDelay: number | undefined;
		let settleUsage: ((usage?: import('../types').SessionUsage) => void) | undefined;
		if (lease) {
			yield {
				type: 'provider_queue_metrics',
				providerId: provider.id,
				queueDelayMs: lease.queueDelayMs,
				attempt,
			};
		}

		try {
			signal.throwIfAborted();
			settleUsage = budget?.reserveModel(context.estimatedTokens, maxTokens);
			for await (const event of llm.stream({
				provider,
				model,
				effort: input.effort,
				systemPrompt: context.systemPrompt,
				messages: context.messages,
				tools: context.tools,
				maxTokens,
				options: modelOptions,
				signal,
				streaming,
			})) {
				if (
					event.type === 'model_call_delta' ||
					event.type === 'model_tool_call_start' ||
					event.type === 'model_tool_call_args_delta'
				) {
					visibleOutput = true;
					firstTokenAt ??= Date.now();
				}
				if (event.type === 'model_call_delta') content += event.delta;
				if (event.type === 'model_provider_item') {
					providerItems.push({
						type: 'provider_item',
						provider: event.provider,
						item: event.item,
					});
				}
				if (event.type === 'model_tool_call_start') {
					pending.set(event.id, { name: event.name, argsText: '' });
				}
				if (event.type === 'model_tool_call_args_delta') {
					const toolCall = pending.get(event.id);
					if (toolCall) toolCall.argsText += event.jsonDelta;
				}
				if (event.type === 'model_call_end') {
					model = event.model;
					stopReason = event.stopReason;
					usage = event.usage;
					yield {
						...event,
						durationMs: Date.now() - attemptStartedAt,
						...(firstTokenAt ? { firstTokenLatencyMs: firstTokenAt - attemptStartedAt } : {}),
						retryCount: attempt,
					};
					continue;
				}
				yield event;
			}

			return {
				content,
				model,
				stopReason,
				usage,
				providerItems,
				toolCalls: [...pending].map(([id, toolCall]) => ({
					id,
					name: toolCall.name,
					args: parseToolArgs(toolCall.argsText),
				})),
			};
		} catch (error) {
			if (
				signal.aborted ||
				budget?.exhausted ||
				error instanceof LlmContextOverflowError ||
				visibleOutput ||
				!isTransientModelError(error) ||
				attempt >= maxRetries
			)
				throw error;
			retryDelay = retryAfterMs(error) ?? Math.min(250 * 2 ** attempt, 2_000);
		} finally {
			settleUsage?.(usage ? { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 } : undefined);
			lease?.release();
		}
		if (retryDelay !== undefined) await wait(retryDelay, undefined, { signal });
	}

	return { content: '', model: modelId, toolCalls: [] };
}
