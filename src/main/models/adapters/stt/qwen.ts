import { SttProviderAuthError, SttProviderRequestError } from './stt_errors';
import type { SttAdapterTranscriptionRequest, SttProviderSpec } from './stt_types';
import type { SttTranscriptionResult } from '../../../../shared/stt_transcription';

export async function transcribe(
	provider: SttProviderSpec,
	request: SttAdapterTranscriptionRequest
): Promise<SttTranscriptionResult> {
	const endpoint = new URL(provider.baseURL || 'https://dashscope-intl.aliyuncs.com/api/v1');
	endpoint.protocol = 'https:';
	endpoint.pathname = '/api/v1/services/aigc/multimodal-generation/generation';
	endpoint.search = '';
	const format =
		request.audio.fileName?.split('.').pop()?.toLowerCase() ||
		request.audio.mimeType.split('/')[1].replace('mpeg', 'mp3').replace('x-wav', 'wav');
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: request.modelId,
			input: {
				messages: [
					...(request.prompt
						? [{ role: 'user', content: [{ type: 'input_text', text: request.prompt }] }]
						: []),
					{
						role: 'user',
						content: [
							{
								type: 'input_audio',
								input_audio: {
									data: `data:${request.audio.mimeType};base64,${request.audio.data}`,
								},
							},
						],
					},
				],
			},
			parameters: { format, ...(request.language ? { language_hints: [request.language] } : {}) },
		}),
		signal: request.signal,
	});
	if (response.status === 401 || response.status === 403)
		throw new SttProviderAuthError(`${provider.name}: ${await response.text()}`);
	if (!response.ok) throw new SttProviderRequestError(`${provider.name}: ${await response.text()}`);
	const result = (await response.json()) as {
		code?: string;
		message?: string;
		output?: { text?: string };
		usage?: {
			input_tokens?: number;
			output_tokens?: number;
			total_tokens?: number;
			duration?: number;
		};
	};
	if (result.code || typeof result.output?.text !== 'string')
		throw new SttProviderRequestError(
			`${provider.name}: ${result.message || 'response contained no transcript'}`
		);
	return {
		text: result.output.text,
		metadata: {
			providerId: provider.id,
			providerName: provider.name,
			modelId: request.modelId,
			language: request.language,
			createdAt: new Date().toISOString(),
			usage: {
				inputTokens: result.usage?.input_tokens,
				outputTokens: result.usage?.output_tokens,
				totalTokens: result.usage?.total_tokens,
				durationSeconds: result.usage?.duration,
			},
		},
	};
}
