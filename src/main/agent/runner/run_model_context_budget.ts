import type { Message, Tool } from '../types';

export const CONTEXT_BYTES_PER_TOKEN = 3;
export const MAX_CONTEXT_TOOL_RESULT_TOKENS = 2_048;

export interface ModelContextBudgetInput {
	systemPrompt?: string;
	protectedSystemPrompt?: string;
	requiredContextMessages?: Message[];
	contextMessages?: Message[];
	messages: Message[];
	tools: Tool[];
	maxInputTokens: number;
}

export interface ModelContextBudgetResult {
	systemPrompt?: string;
	messages: Message[];
	tools: Tool[];
	estimatedTokens: number;
}

function contextBytes(value: unknown): number {
	return Buffer.byteLength(
		JSON.stringify(value, function (key, current: unknown) {
			if (
				key === 'base64' &&
				typeof current === 'string' &&
				this &&
				typeof this === 'object' &&
				['image', 'document', 'file'].includes(String((this as Record<string, unknown>).type))
			) {
				return `[binary attachment: ${Math.floor((current.length * 3) / 4)} bytes]`;
			}
			return current;
		}),
		'utf8'
	);
}

export function fitModelContext(input: ModelContextBudgetInput): ModelContextBudgetResult {
	const maxInputTokens = Math.max(256, Math.floor(input.maxInputTokens));
	const toolView = input.tools.map((tool) => ({
		name: tool.id,
		description: tool.description,
		schema: tool.schema,
	}));
	const combinedSystemPrompt = [input.systemPrompt, input.protectedSystemPrompt]
		.filter(Boolean)
		.join('\n\n');
	const contextMessages = input.contextMessages ?? [];
	const requiredContextMessages = input.requiredContextMessages ?? [];
	const fullTokens =
		Math.ceil(
			contextBytes({
				systemPrompt: combinedSystemPrompt,
				messages: [...requiredContextMessages, ...contextMessages, ...input.messages],
				tools: toolView,
			}) / CONTEXT_BYTES_PER_TOKEN
		) + 32;
	if (fullTokens <= maxInputTokens) {
		return {
			systemPrompt: combinedSystemPrompt || undefined,
			messages: [...requiredContextMessages, ...contextMessages, ...input.messages],
			tools: input.tools,
			estimatedTokens: fullTokens,
		};
	}

	const messages = structuredClone(input.messages);
	for (const message of messages) {
		if (message.role !== 'assistant') continue;
		if (Array.isArray(message.content)) {
			message.content = message.content.map((block) => {
				if (block.type !== 'provider_item') return block;
				const bytes = Buffer.byteLength(JSON.stringify(block), 'utf8');
				return bytes / CONTEXT_BYTES_PER_TOKEN > MAX_CONTEXT_TOOL_RESULT_TOKENS
					? { type: 'text', text: `[provider state omitted: ${bytes} bytes]` }
					: block;
			});
		}
		message.toolCalls = message.toolCalls?.map((call) => {
			const argsBytes = Buffer.byteLength(JSON.stringify(call.args), 'utf8');
			const resultBytes = call.result
				? Buffer.byteLength(JSON.stringify(call.result.content), 'utf8')
				: 0;
			return {
				...call,
				...(argsBytes / CONTEXT_BYTES_PER_TOKEN > MAX_CONTEXT_TOOL_RESULT_TOKENS
					? { args: { omitted: `[tool arguments omitted: ${argsBytes} bytes]` } }
					: {}),
				...(call.result && resultBytes / CONTEXT_BYTES_PER_TOKEN > MAX_CONTEXT_TOOL_RESULT_TOKENS
					? {
							result: {
								...call.result,
								content: `[tool result omitted: ${resultBytes} bytes]`,
							},
						}
					: {}),
			};
		});
	}

	let latestUserIndex = -1;
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		if (messages[index].role !== 'user') continue;
		latestUserIndex = index;
		break;
	}
	if (latestUserIndex < 0) latestUserIndex = Math.max(0, messages.length - 1);
	let selectedMessages = messages.slice(latestUserIndex);

	const minimumSystem = (input.systemPrompt ?? '').slice(0, 1_536);
	let systemPrompt = input.systemPrompt ?? '';
	const protectedSystemPrompt = input.protectedSystemPrompt ?? '';
	let mandatoryTokens =
		Math.ceil(
			contextBytes({
				systemPrompt: [minimumSystem, protectedSystemPrompt].filter(Boolean).join('\n\n'),
				messages: [...requiredContextMessages, ...selectedMessages],
				tools: toolView,
			}) / CONTEXT_BYTES_PER_TOKEN
		) + 32;
	if (mandatoryTokens > maxInputTokens) {
		throw new Error(
			protectedSystemPrompt
					? 'The active skill instructions, workspace context, current user turn, and available tool schemas exceed the model context budget.'
					: 'The workspace context, current user turn, and available tool schemas exceed the model context budget.'
		);
	}

	mandatoryTokens =
		Math.ceil(
			contextBytes({
				systemPrompt: [systemPrompt, protectedSystemPrompt].filter(Boolean).join('\n\n'),
				messages: [...requiredContextMessages, ...selectedMessages],
				tools: toolView,
			}) / CONTEXT_BYTES_PER_TOKEN
		) + 32;
	if (mandatoryTokens > maxInputTokens) {
		const marker = '\n\n[Additional system context omitted to fit the model context budget.]';
		const excessCharacters = (mandatoryTokens - maxInputTokens) * CONTEXT_BYTES_PER_TOKEN;
		systemPrompt = `${systemPrompt.slice(0, Math.max(minimumSystem.length, systemPrompt.length - excessCharacters - marker.length))}${marker}`;
		while (
			Math.ceil(
				contextBytes({
					systemPrompt: [systemPrompt, protectedSystemPrompt].filter(Boolean).join('\n\n'),
						messages: [...requiredContextMessages, ...selectedMessages],
					tools: toolView,
				}) / CONTEXT_BYTES_PER_TOKEN
			) +
				32 >
			maxInputTokens
		) {
			if (systemPrompt.length <= minimumSystem.length + marker.length) {
				systemPrompt = minimumSystem;
				break;
			}
			systemPrompt = `${systemPrompt.slice(0, -Math.min(512, systemPrompt.length - minimumSystem.length - marker.length) - marker.length)}${marker}`;
		}
	}

	const selectedTools = input.tools;
	const optionalContextMessages = [...contextMessages];
	while (optionalContextMessages.length > 0) {
		const candidateTokens =
			Math.ceil(
				contextBytes({
					systemPrompt: [systemPrompt, protectedSystemPrompt].filter(Boolean).join('\n\n'),
						messages: [...requiredContextMessages, ...optionalContextMessages, ...selectedMessages],
					tools: toolView,
				}) / CONTEXT_BYTES_PER_TOKEN
			) + 32;
		if (candidateTokens <= maxInputTokens) break;
		optionalContextMessages.pop();
	}

	let cursor = latestUserIndex;
	let omittedPrior = false;
	while (cursor > 0) {
		let previousUserIndex = cursor - 1;
		while (previousUserIndex > 0 && messages[previousUserIndex].role !== 'user') {
			previousUserIndex -= 1;
		}
		const candidateMessages = [...messages.slice(previousUserIndex, cursor), ...selectedMessages];
		const candidateTokens =
			Math.ceil(
				contextBytes({
					systemPrompt: [systemPrompt, protectedSystemPrompt].filter(Boolean).join('\n\n'),
						messages: [...requiredContextMessages, ...optionalContextMessages, ...candidateMessages],
					tools: toolView,
				}) / CONTEXT_BYTES_PER_TOKEN
			) + 32;
		if (candidateTokens > maxInputTokens) {
			omittedPrior = true;
			break;
		}
		selectedMessages = candidateMessages;
		cursor = previousUserIndex;
	}

	if (omittedPrior) {
		const marker: Message = {
			role: 'user',
			content: '[Earlier conversation omitted to fit the model context budget.]',
		};
		const candidateMessages = [marker, ...selectedMessages];
		const markerTokens =
			Math.ceil(
				contextBytes({
					systemPrompt: [systemPrompt, protectedSystemPrompt].filter(Boolean).join('\n\n'),
						messages: [...requiredContextMessages, ...optionalContextMessages, ...candidateMessages],
					tools: toolView,
				}) / CONTEXT_BYTES_PER_TOKEN
			) + 32;
		if (markerTokens <= maxInputTokens) selectedMessages = candidateMessages;
	}

	const estimatedTokens =
		Math.ceil(
			contextBytes({
				systemPrompt: [systemPrompt, protectedSystemPrompt].filter(Boolean).join('\n\n'),
				messages: [...requiredContextMessages, ...optionalContextMessages, ...selectedMessages],
				tools: toolView,
			}) / CONTEXT_BYTES_PER_TOKEN
		) + 32;
	return {
		systemPrompt: [systemPrompt, protectedSystemPrompt].filter(Boolean).join('\n\n') || undefined,
			messages: [...requiredContextMessages, ...optionalContextMessages, ...selectedMessages],
		tools: selectedTools,
		estimatedTokens,
	};
}
