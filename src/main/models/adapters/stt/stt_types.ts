import type {
	SttRealtimeEvent,
	SttRealtimeStartRequest,
	SttRealtimeSession,
	SttTranscriptionRequest,
	SttTranscriptionResult,
} from '../../../../shared/stt_transcription';
import type { ModelMetadata } from '../../../../shared/model_types';

export interface SttProviderSpec {
	id: string;
	name: string;
	apiKey: string;
	baseURL: string;
	protocol?: string;
}

export interface SttAdapterTranscriptionRequest extends SttTranscriptionRequest {
	providerId: string;
	modelId: string;
	metadata?: ModelMetadata;
	signal?: AbortSignal;
}

export interface SttAdapterRealtimeStartRequest extends SttRealtimeStartRequest {
	sessionId: string;
	providerId: string;
	providerName: string;
	modelId: string;
	sampleRate: number;
	metadata?: ModelMetadata;
}

export type SttRealtimeEventHandler = (event: SttRealtimeEvent) => void;

export interface SttRealtimeConnection {
	appendAudio(audio: string): Promise<void>;
	finish(): Promise<void>;
	cancel(): Promise<void>;
}

export interface SttAdapter {
	transcribe(request: SttAdapterTranscriptionRequest): Promise<SttTranscriptionResult>;
	startRealtime?(
		request: SttAdapterRealtimeStartRequest,
		emit: SttRealtimeEventHandler
	): Promise<SttRealtimeConnection>;
}

export interface SttActiveRealtimeSession {
	info: SttRealtimeSession;
	connection: SttRealtimeConnection;
}
