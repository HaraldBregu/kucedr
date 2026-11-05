import { LlmModel } from '../adapters/llm';
import { preflightPromptAttachments, resolvePromptInputCapabilities } from '../../agent/attachments';
import type { TextRequest } from '../../../shared/text_types';
import { getResolvedProvider } from '../../settings_store';
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

	const provider = getResolvedProvider(providerId);
	if (!provider) throw new Error(`Provider not configured: ${providerId}`);

	const capabilities = resolvePromptInputCapabilities(providerId, modelId);
	if (request.files?.length && !capabilities) throw new Error('Attachments require a valid configured prompt model.');
	const files = request.files?.length && capabilities ? preflightPromptAttachments(request.files, capabilities) : [];

	const response = await llmModel.generate({
		provider,
		model: modelId,
		effort: request.effort,
		messages: [{ role: 'user', content: files.length ? [{ type: 'text', text: prompt }, ...files] : prompt }],
		maxTokens: request.maxTokens ?? MAX_TOKENS,
	});
	return response.content;
}
