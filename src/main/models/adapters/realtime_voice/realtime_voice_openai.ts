import OpenAI from 'openai';
import { OpenAIRealtimeWS } from 'openai/realtime/ws';
import { OpenAICompatibleRealtimeVoiceAdapter } from './realtime_voice_compatible';
import { OpenAILiveVoiceAdapter } from './realtime_voice_live';
import type {
	RealtimeVoiceAdapter,
	RealtimeVoiceAdapterEventHandler,
	RealtimeVoiceAdapterRequest,
	RealtimeVoiceConnection,
	RealtimeVoiceProviderSpec,
	RealtimeVoiceSocket,
	RealtimeVoiceSocketFactory,
} from './realtime_voice_types';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const OPENAI_REALTIME_VOICE_MODELS = ['gpt-realtime-2.1', 'gpt-realtime-2.1-mini'] as const;
export const OPENAI_LIVE_VOICE_MODELS = ['gpt-live-1'] as const;
export const OPENAI_VOICE_MODELS = [
	...OPENAI_REALTIME_VOICE_MODELS,
	...OPENAI_LIVE_VOICE_MODELS,
] as const;

export class OpenAIRealtimeVoiceAdapter implements RealtimeVoiceAdapter {
	private readonly compatible: OpenAICompatibleRealtimeVoiceAdapter;
	private readonly provider: RealtimeVoiceProviderSpec;

	constructor(
		provider: RealtimeVoiceProviderSpec,
		socketFactory: RealtimeVoiceSocketFactory = createOpenAISocket,
		connectTimeoutMs?: number
	) {
		this.provider = provider;
		this.compatible = new OpenAICompatibleRealtimeVoiceAdapter(
			{
				provider,
				modelIds: OPENAI_REALTIME_VOICE_MODELS,
				socketFactory,
				session: openAISession,
			},
			connectTimeoutMs
		);
	}

	connect(
		request: RealtimeVoiceAdapterRequest,
		emit: RealtimeVoiceAdapterEventHandler,
		signal?: AbortSignal
	): Promise<RealtimeVoiceConnection> {
		if (request.modelId === 'gpt-live-1') {
			return new OpenAILiveVoiceAdapter(this.provider).connect(request, emit, signal);
		}
		return this.compatible.connect(request, emit, signal);
	}
}

function createOpenAISocket(
	provider: RealtimeVoiceProviderSpec,
	modelId: string
): RealtimeVoiceSocket {
	const client = new OpenAI({
		apiKey: provider.apiKey,
		baseURL: OPENAI_BASE_URL,
	});
	return new OpenAIRealtimeWS({ model: modelId }, client) as unknown as RealtimeVoiceSocket;
}

function openAISession(request: RealtimeVoiceAdapterRequest): Record<string, unknown> {
	return {
		type: 'realtime',
		model: request.modelId,
		instructions: request.instructions,
		output_modalities: ['audio'],
		parallel_tool_calls: false,
		audio: {
			input: {
				format: { type: 'audio/pcm', rate: 24_000 },
				noise_reduction: { type: 'near_field' },
				transcription: { model: 'gpt-4o-mini-transcribe' },
				turn_detection: {
					type: 'server_vad',
					silence_duration_ms: 1_200,
					create_response: true,
					interrupt_response: true,
				},
			},
			output: {
				format: { type: 'audio/pcm', rate: 24_000 },
				voice: request.voice.trim() || 'marin',
			},
		},
		tool_choice: 'auto',
		tools: request.tools.map((tool) => ({
			type: 'function',
			name: tool.id,
			description: tool.description,
			parameters: tool.schema,
		})),
	};
}
