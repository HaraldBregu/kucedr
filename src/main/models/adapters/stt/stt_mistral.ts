import { speechToTextBaseUrl } from '../../../models';
import { Mistral } from '@mistralai/mistralai';
import { createAudioFile } from './stt_audio';
import { SttProviderAuthError } from './stt_errors';
import type {
	SttAdapter,
	SttAdapterRealtimeStartRequest,
	SttAdapterTranscriptionRequest,
	SttProviderSpec,
	SttRealtimeConnection,
	SttRealtimeEventHandler,
} from './stt_types';
import type { SttTranscriptionResult, SttUsage } from '../../../../shared/stt_transcription';

type MistralTranscriptionClient = {
	audio: {
		transcriptions: {
			complete: (
				request: {
					model: string;
					file: Blob;
					language?: string;
					temperature?: number;
					stream?: false;
				},
				options?: { signal?: AbortSignal; serverURL?: string | URL }
			) => Promise<{
				text: string;
				language?: string | null;
				usage?: {
					promptTokens?: number;
					completionTokens?: number;
					totalTokens?: number;
					promptAudioSeconds?: number | null;
				};
			}>;
		};
	};
};

export interface MistralSttAdapterOptions extends SttProviderSpec {
	clientFactory?: (opts: { apiKey: string; baseURL?: string }) => MistralTranscriptionClient;
}

export function createMistralSttAdapter(opts: MistralSttAdapterOptions): SttAdapter {
	if (!opts.apiKey) throw new SttProviderAuthError(`${opts.name} API key not configured.`);
	const provider = opts;
	const factory =
		opts.clientFactory ??
		((c) =>
			new Mistral({
				apiKey: c.apiKey,
				...(c.baseURL ? { serverURL: c.baseURL } : {}),
			}) as MistralTranscriptionClient);
	const client = factory({ apiKey: opts.apiKey, baseURL: opts.baseURL });

	return {
		async transcribe(request: SttAdapterTranscriptionRequest): Promise<SttTranscriptionResult> {
			try {
				const file = await createAudioFile(request.audio);
				const response = await client.audio.transcriptions.complete(
					{
						model: request.modelId,
						file,
						language: request.language,
						temperature: request.temperature,
						stream: false,
					},
					{
						signal: request.signal,
						...(provider.baseURL ? { serverURL: provider.baseURL } : {}),
					}
				);
				const usage = toUsage(response.usage);

				return {
					text: response.text,
					metadata: {
						providerId: provider.id,
						providerName: provider.name,
						modelId: request.modelId,
						...(response.language || request.language
							? { language: response.language ?? request.language }
							: {}),
						createdAt: new Date().toISOString(),
						...(usage ? { usage } : {}),
					},
				};
			} catch (error) {
				const status =
					(error as { status?: number; statusCode?: number }).status ??
					(error as { statusCode?: number }).statusCode ??
					0;
				const message = (error as Error).message ?? String(error);
				if (status === 401 || status === 403) throw new SttProviderAuthError(message);
				throw error;
			}
		},

		async startRealtime(
			request: SttAdapterRealtimeStartRequest,
			emit: SttRealtimeEventHandler
		): Promise<SttRealtimeConnection> {
			const { AudioEncoding, RealtimeTranscription } =
				await import('@mistralai/mistralai/extra/realtime');
			const client = new RealtimeTranscription({
				apiKey: provider.apiKey,
				serverURL: realtimeBaseUrl(provider.baseURL),
			});
			const connection = await client.connect(request.modelId, {
				audioFormat: {
					encoding: AudioEncoding.PcmS16le,
					sampleRate: request.sampleRate,
				},
			});
			return createMistralRealtimeConnection(
				connection as unknown as MistralRealtimeConnection,
				request,
				emit
			);
		},
	};
}

type MistralRealtimeEvent = {
	type: string;
	text?: string;
	error?: { message?: unknown };
};

type MistralRealtimeConnection = AsyncIterable<MistralRealtimeEvent> & {
	sendAudio(audioBytes: Uint8Array | ArrayBuffer): Promise<void>;
	endAudio(): Promise<void>;
	close(code?: number, reason?: string): Promise<void>;
};

function createMistralRealtimeConnection(
	connection: MistralRealtimeConnection,
	request: SttAdapterRealtimeStartRequest,
	emit: SttRealtimeEventHandler
): SttRealtimeConnection {
	let closed = false;
	let transcript = '';

	const emitError = (message: string): void => {
		if (!closed) emit({ type: 'error', sessionId: request.sessionId, message });
	};

	const emitClosed = (): void => {
		if (closed) return;
		closed = true;
		emit({ type: 'closed', sessionId: request.sessionId });
	};

	const readEvents = async (): Promise<void> => {
		try {
			for await (const event of connection) {
				if (event.type === 'transcription.text.delta' && event.text) {
					transcript += event.text;
					emit({
						type: 'delta',
						sessionId: request.sessionId,
						itemId: request.sessionId,
						contentIndex: 0,
						delta: event.text,
					});
					continue;
				}
				if (event.type === 'transcription.done') {
					emit({
						type: 'completed',
						sessionId: request.sessionId,
						itemId: request.sessionId,
						contentIndex: 0,
						transcript: event.text ?? transcript,
					});
					await connection.close(1000, 'completed');
					emitClosed();
					return;
				}
				if (event.type === 'error') {
					emitError(errorMessage(event.error, 'Mistral realtime transcription error.'));
				}
			}
		} catch (error) {
			emitError(errorMessage(error, 'Mistral realtime transcription failed.'));
		} finally {
			emitClosed();
		}
	};

	void readEvents();

	return {
		async appendAudio(audio: string): Promise<void> {
			await connection.sendAudio(Buffer.from(audio, 'base64'));
		},

		async finish(): Promise<void> {
			await connection.endAudio();
		},

		async cancel(): Promise<void> {
			await connection.close(1000, 'cancelled');
			emitClosed();
		},
	};
}

function realtimeBaseUrl(baseURL: string | undefined): string {
	return (baseURL ?? speechToTextBaseUrl('mistral')).replace(
		/\/v1\/?$/,
		''
	);
}

function errorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) return error.message;
	if (
		error &&
		typeof error === 'object' &&
		typeof (error as { message?: unknown }).message === 'string'
	) {
		return (error as { message: string }).message;
	}
	return fallback;
}

function toUsage(usage: unknown): SttUsage | undefined {
	if (!usage || typeof usage !== 'object') return undefined;
	const value = usage as {
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
		promptAudioSeconds?: number | null;
	};
	const next: SttUsage = {
		...(typeof value.promptTokens === 'number' ? { inputTokens: value.promptTokens } : {}),
		...(typeof value.completionTokens === 'number' ? { outputTokens: value.completionTokens } : {}),
		...(typeof value.totalTokens === 'number' ? { totalTokens: value.totalTokens } : {}),
		...(typeof value.promptAudioSeconds === 'number'
			? { durationSeconds: value.promptAudioSeconds }
			: {}),
	};
	return Object.keys(next).length > 0 ? next : undefined;
}
