import { LlmModel } from '../adapters/llm';
import type { TextRequest } from '../../../shared/text_types';
import { getResolvedProvider } from '../../settings_store';

export async function streamText(request: TextRequest, signal: AbortSignal, onDelta: (delta: string) => void): Promise<void> {
	const prompt = request.prompt?.trim();
	if (!prompt) throw new Error('Prompt is required.');
	const providerId = request.providerId?.trim();
	const modelId = request.modelId?.trim();
	if (!providerId || !modelId) throw new Error('Text model not configured.');
	const provider = getResolvedProvider(providerId);
	if (!provider) throw new Error(`Provider not configured: ${providerId}`);
	for await (const event of new LlmModel().stream({ provider, model: modelId, effort: request.effort, messages: [{ role: 'user', content: prompt }], maxTokens: request.maxTokens ?? 4096, signal, streaming: true })) {
		if (event.type === 'model_call_delta') onDelta(event.delta);
	}
}
