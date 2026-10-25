import { LlmModel } from '../adapters/llm';
import type { TextRequest } from '../../../shared/text_types';
import { getProvider } from '../../settings_store';
import { getModelId, getProviderId } from '../selection';

const llmModel = new LlmModel();
const MAX_TOKENS = 4096;

export async function generateText(request: TextRequest): Promise<string> {
	const prompt = request.prompt?.trim();
	if (!prompt) throw new Error('Prompt is required.');

	const providerId = request.providerId?.trim() || getProviderId('text');
	if (!providerId) throw new Error('Text provider not configured.');

	const modelId = request.modelId?.trim() || getModelId('text');
	if (!modelId) throw new Error('Text model not configured.');

	const provider = getProvider(providerId);
	if (!provider) throw new Error(`Provider not configured: ${providerId}`);

	const response = await llmModel.generate({
		provider: { id: providerId, apiKey: provider.apiKey, baseURL: provider.baseUrl },
		model: modelId,
		messages: [{ role: 'user', content: prompt }],
		maxTokens: request.maxTokens ?? MAX_TOKENS,
	});
	return response.content;
}
