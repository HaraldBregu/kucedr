import OpenAI from 'openai';
import { OpenAIRealtimeWS } from 'openai/realtime/ws';
import { OpenAICompatibleRealtimeVoiceAdapter } from './realtime_voice_compatible';
import type {
	RealtimeVoiceAdapter,
	RealtimeVoiceAdapterEventHandler,
	RealtimeVoiceAdapterRequest,
	RealtimeVoiceConnection,
	RealtimeVoiceProviderSpec,
	RealtimeVoiceSocket,
	RealtimeVoiceSocketFactory,
} from './realtime_voice_types';

const XAI_BASE_URL = 'https://api.x.ai/v1';
export const XAI_REALTIME_VOICE_MODELS = ['grok-voice-latest'] as const;

export class XAIRealtimeVoiceAdapter implements RealtimeVoiceAdapter {
	private readonly compatible: OpenAICompatibleRealtimeVoiceAdapter;

	constructor(
		provider: RealtimeVoiceProviderSpec,
		socketFactory: RealtimeVoiceSocketFactory = createXAISocket,
		connectTimeoutMs?: number
	) {
		this.compatible = new OpenAICompatibleRealtimeVoiceAdapter(
			{
				provider,
				modelIds: XAI_REALTIME_VOICE_MODELS,
				socketFactory,
				session: xaiSession,
			},
			connectTimeoutMs
		);
	}

	connect(
		request: RealtimeVoiceAdapterRequest,
		emit: RealtimeVoiceAdapterEventHandler,
		signal?: AbortSignal
	): Promise<RealtimeVoiceConnection> {
		return this.compatible.connect(request, emit, signal);
	}
}

function createXAISocket(
	provider: RealtimeVoiceProviderSpec,
	modelId: string
): RealtimeVoiceSocket {
	const client = new OpenAI({
		apiKey: provider.apiKey,
		baseURL: XAI_BASE_URL,
	});
	return new OpenAIRealtimeWS({ model: modelId }, client) as unknown as RealtimeVoiceSocket;
}

function xaiSession(request: RealtimeVoiceAdapterRequest): Record<string, unknown> {
	return {
		instructions: request.instructions,
		voice: request.voice.trim() || 'eve',
		turn_detection: {
			type: 'server_vad',
			threshold: 0.5,
			prefix_padding_ms: 333,
			silence_duration_ms: 1_200,
		},
		parallel_tool_calls: false,
		audio: {
			input: {
				format: { type: 'audio/pcm', rate: 24_000 },
				transcription: { model: 'grok-transcribe' },
			},
			output: { format: { type: 'audio/pcm', rate: 24_000 } },
		},
		tools: request.tools.map((tool) => ({
			type: 'function',
			name: tool.id,
			description: tool.description,
			parameters: tool.schema,
		})),
	};
}
