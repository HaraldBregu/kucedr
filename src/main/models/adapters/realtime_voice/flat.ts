import { createRealtimeSocket } from './client';
import { CompatibleRealtimeVoiceAdapter } from './realtime_voice_compatible';
import type {
	RealtimeVoiceAdapter,
	RealtimeVoiceAdapterEventHandler,
	RealtimeVoiceAdapterRequest,
	RealtimeVoiceConnection,
	RealtimeVoiceModelSpec,
	RealtimeVoiceProviderSpec,
	RealtimeVoiceSocketFactory,
} from './realtime_voice_types';

export class FlatRealtimeVoiceAdapter implements RealtimeVoiceAdapter {
	private readonly compatible: CompatibleRealtimeVoiceAdapter;

	constructor(
		provider: RealtimeVoiceProviderSpec,
		model: RealtimeVoiceModelSpec,
		socketFactory: RealtimeVoiceSocketFactory = createRealtimeSocket,
		connectTimeoutMs?: number
	) {
		this.compatible = new CompatibleRealtimeVoiceAdapter(
			{
				provider,
				model,
				serverInterrupts: false,
				socketFactory,
				session: flatSession,
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

function flatSession(request: RealtimeVoiceAdapterRequest): Record<string, unknown> {
	return {
		instructions: request.instructions,
		voice: request.voice.trim(),
		turn_detection: {
			type: 'server_vad',
			threshold: 0.5,
			prefix_padding_ms: 333,
			silence_duration_ms: 1_200,
		},
		parallel_tool_calls: false,
		audio: {
			input: { format: { type: 'audio/pcm', rate: 24_000 } },
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
