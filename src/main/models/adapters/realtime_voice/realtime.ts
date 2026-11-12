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

export class RealtimeSessionVoiceAdapter implements RealtimeVoiceAdapter {
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
				serverInterrupts: true,
				socketFactory,
				session: realtimeSession,
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

function realtimeSession(request: RealtimeVoiceAdapterRequest): Record<string, unknown> {
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
				turn_detection: {
					type: 'server_vad',
					silence_duration_ms: 1_200,
					create_response: true,
					interrupt_response: true,
				},
			},
			output: {
				format: { type: 'audio/pcm', rate: 24_000 },
				voice: request.voice.trim(),
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
