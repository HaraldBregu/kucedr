import { typedInvokeUnwrap, typedOn } from '../shared/ipc_types';
import {
	EmbeddingChannels,
	ImageChannels,
	SoundChannels,
	SpeechChannels,
	RealtimeVoiceChannels,
	SttChannels,
	TextChannels,
	VideoChannels,
} from '../shared/ipc_channels_definitions';
import type { ModelsApi } from './index.d';
import {
	normalizeSttRealtimeAudioChunk,
	normalizeSttRealtimeStartRequest,
	normalizeSttTranscriptionRequest,
} from '../shared/stt_transcription';
import { normalizeSpeechSynthesisRequest } from '../shared/speech_types';
import { REALTIME_VOICE_MAX_AUDIO_BASE64_LENGTH } from '../shared/realtime_voice';
import { normalizeImageSource } from '../shared/image_types';
import { optionalTrimmedString } from './normalize';

function isSttRealtimeSessionId(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function normalizeOptions(value: unknown): Record<string, unknown> | undefined {
	if (value === undefined) return undefined;
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Invalid model options.');
	}
	return { ...(value as Record<string, unknown>) };
}

export const models: ModelsApi = {
	embedding: {
		createEmbedding: (request) => {
			const texts = (request?.texts ?? [])
				.map((text) => optionalTrimmedString(text))
				.filter((text): text is string => Boolean(text));
			if (texts.length === 0) throw new Error('Invalid embedding input.');
			const providerId = optionalTrimmedString(request?.providerId);
			const modelId = optionalTrimmedString(request?.modelId);
			return typedInvokeUnwrap(EmbeddingChannels.createEmbedding, {
				texts,
				...(request?.inputType ? { inputType: request.inputType } : {}),
				...(providerId ? { providerId } : {}),
				...(modelId ? { modelId } : {}),
			});
		},
		getProviderId: () => {
			return typedInvokeUnwrap(EmbeddingChannels.getProviderId);
		},
		setProviderId: (providerId) => {
			const normalizedProviderId = optionalTrimmedString(providerId);
			if (!normalizedProviderId) throw new Error('Invalid embedding provider id.');
			return typedInvokeUnwrap(EmbeddingChannels.setProviderId, normalizedProviderId);
		},
		getModelId: () => {
			return typedInvokeUnwrap(EmbeddingChannels.getModelId);
		},
		setModelId: (modelId) => {
			const normalizedModelId = optionalTrimmedString(modelId);
			if (!normalizedModelId) throw new Error('Invalid embedding model id.');
			return typedInvokeUnwrap(EmbeddingChannels.setModelId, normalizedModelId);
		},
	},
	image: {
		createImage: (request) => {
			const prompt = optionalTrimmedString(request?.prompt);
			if (!prompt) throw new Error('Invalid image prompt.');
			const providerId = optionalTrimmedString(request?.providerId);
			const modelId = optionalTrimmedString(request?.modelId);
			const source = normalizeImageSource(request?.source);
			const options = normalizeOptions(request?.options);
			return typedInvokeUnwrap(ImageChannels.createImage, {
				prompt,
				...(providerId ? { providerId } : {}),
				...(modelId ? { modelId } : {}),
				...(source ? { source } : {}),
				...(options ? { options } : {}),
			});
		},
		getProviderId: () => {
			return typedInvokeUnwrap(ImageChannels.getProviderId);
		},
		setProviderId: (providerId) => {
			const normalizedProviderId = optionalTrimmedString(providerId);
			if (!normalizedProviderId) throw new Error('Invalid image provider id.');
			return typedInvokeUnwrap(ImageChannels.setProviderId, normalizedProviderId);
		},
		getModelId: () => {
			return typedInvokeUnwrap(ImageChannels.getModelId);
		},
		setModelId: (modelId) => {
			const normalizedModelId = optionalTrimmedString(modelId);
			if (!normalizedModelId) throw new Error('Invalid image model id.');
			return typedInvokeUnwrap(ImageChannels.setModelId, normalizedModelId);
		},
		getOptions: () => typedInvokeUnwrap(ImageChannels.getOptions),
		setOptions: (options) =>
			typedInvokeUnwrap(ImageChannels.setOptions, normalizeOptions(options) ?? {}),
	},
	sound: {
		createSound: (request) => {
			const prompt = optionalTrimmedString(request?.prompt);
			if (!prompt) throw new Error('Invalid sound prompt.');
			const providerId = optionalTrimmedString(request?.providerId);
			const modelId = optionalTrimmedString(request?.modelId);
			const options = normalizeOptions(request?.options);
			return typedInvokeUnwrap(SoundChannels.createSound, {
				prompt,
				...(providerId ? { providerId } : {}),
				...(modelId ? { modelId } : {}),
				...(options ? { options } : {}),
			});
		},
		listSounds: () => {
			return typedInvokeUnwrap(SoundChannels.listSounds);
		},
		getProviderId: () => {
			return typedInvokeUnwrap(SoundChannels.getProviderId);
		},
		setProviderId: (providerId) => {
			const normalizedProviderId = optionalTrimmedString(providerId);
			if (!normalizedProviderId) throw new Error('Invalid sound provider id.');
			return typedInvokeUnwrap(SoundChannels.setProviderId, normalizedProviderId);
		},
		getModelId: () => {
			return typedInvokeUnwrap(SoundChannels.getModelId);
		},
		setModelId: (modelId) => {
			const normalizedModelId = optionalTrimmedString(modelId);
			if (!normalizedModelId) throw new Error('Invalid sound model id.');
			return typedInvokeUnwrap(SoundChannels.setModelId, normalizedModelId);
		},
		getOptions: () => typedInvokeUnwrap(SoundChannels.getOptions),
		setOptions: (options) =>
			typedInvokeUnwrap(SoundChannels.setOptions, normalizeOptions(options) ?? {}),
	},
	text: {
		generateText: (request) => {
			const prompt = optionalTrimmedString(request?.prompt);
			if (!prompt) throw new Error('Invalid text prompt.');
			const providerId = optionalTrimmedString(request?.providerId);
			const modelId = optionalTrimmedString(request?.modelId);
			const maxTokens = request?.maxTokens;
			if (maxTokens !== undefined && !(Number.isInteger(maxTokens) && maxTokens > 0)) {
				throw new Error('Invalid text max tokens.');
			}
			return typedInvokeUnwrap(TextChannels.generateText, {
				prompt,
				...(providerId ? { providerId } : {}),
				...(modelId ? { modelId } : {}),
				...(maxTokens ? { maxTokens } : {}),
			});
		},
		getProviderId: () => {
			return typedInvokeUnwrap(TextChannels.getProviderId);
		},
		setProviderId: (providerId) => {
			const normalizedProviderId = optionalTrimmedString(providerId);
			if (!normalizedProviderId) throw new Error('Invalid text provider id.');
			return typedInvokeUnwrap(TextChannels.setProviderId, normalizedProviderId);
		},
		getModelId: () => {
			return typedInvokeUnwrap(TextChannels.getModelId);
		},
		setModelId: (modelId) => {
			const normalizedModelId = optionalTrimmedString(modelId);
			if (!normalizedModelId) throw new Error('Invalid text model id.');
			return typedInvokeUnwrap(TextChannels.setModelId, normalizedModelId);
		},
	},
	transcribe: {
		transcribe: (request) => {
			return typedInvokeUnwrap(SttChannels.transcribe, normalizeSttTranscriptionRequest(request));
		},
		startRealtime: (request) => {
			return typedInvokeUnwrap(
				SttChannels.startRealtime,
				normalizeSttRealtimeStartRequest(request)
			);
		},
		appendRealtimeAudio: (sessionId, audio) => {
			if (!isSttRealtimeSessionId(sessionId)) {
				throw new Error('Invalid speech-to-text realtime session id.');
			}
			return typedInvokeUnwrap(
				SttChannels.appendRealtimeAudio,
				sessionId,
				normalizeSttRealtimeAudioChunk(audio)
			);
		},
		finishRealtime: (sessionId) => {
			if (!isSttRealtimeSessionId(sessionId)) {
				throw new Error('Invalid speech-to-text realtime session id.');
			}
			return typedInvokeUnwrap(SttChannels.finishRealtime, sessionId);
		},
		cancelRealtime: (sessionId) => {
			if (!isSttRealtimeSessionId(sessionId)) {
				throw new Error('Invalid speech-to-text realtime session id.');
			}
			return typedInvokeUnwrap(SttChannels.cancelRealtime, sessionId);
		},
		onRealtimeEvent: (callback) => {
			return typedOn(SttChannels.realtimeEvent, callback);
		},
		getSelection: (mode) => {
			return typedInvokeUnwrap(SttChannels.getSelection, mode);
		},
		listProviders: () => {
			return typedInvokeUnwrap(SttChannels.listProviders);
		},
		listModels: (providerId) => {
			const normalizedProviderId = optionalTrimmedString(providerId);
			if (!normalizedProviderId) throw new Error('Invalid speech-to-text provider id.');
			return typedInvokeUnwrap(SttChannels.listModels, normalizedProviderId);
		},
		saveSelection: (providerId, modelId, mode) => {
			const normalizedProviderId = optionalTrimmedString(providerId);
			const normalizedModelId = optionalTrimmedString(modelId);
			if (!normalizedProviderId) throw new Error('Invalid speech-to-text provider id.');
			if (!normalizedModelId) throw new Error('Invalid speech-to-text model id.');
			return typedInvokeUnwrap(
				SttChannels.saveSelection,
				normalizedProviderId,
				normalizedModelId,
				mode
			);
		},
		getProviderId: () => {
			return typedInvokeUnwrap(SttChannels.getProviderId);
		},
		setProviderId: (providerId) => {
			const normalizedProviderId = optionalTrimmedString(providerId);
			if (!normalizedProviderId) throw new Error('Invalid transcribe provider id.');
			return typedInvokeUnwrap(SttChannels.setProviderId, normalizedProviderId);
		},
		getModelId: () => {
			return typedInvokeUnwrap(SttChannels.getModelId);
		},
		setModelId: (modelId) => {
			const normalizedModelId = optionalTrimmedString(modelId);
			if (!normalizedModelId) throw new Error('Invalid transcribe model id.');
			return typedInvokeUnwrap(SttChannels.setModelId, normalizedModelId);
		},
	},
	video: {
		createVideo: (request) => {
			const prompt = optionalTrimmedString(request?.prompt);
			if (!prompt) throw new Error('Invalid video prompt.');
			const providerId = optionalTrimmedString(request?.providerId);
			const modelId = optionalTrimmedString(request?.modelId);
			const options = normalizeOptions(request?.options);
			return typedInvokeUnwrap(VideoChannels.createVideo, {
				prompt,
				...(providerId ? { providerId } : {}),
				...(modelId ? { modelId } : {}),
				...(options ? { options } : {}),
			});
		},
		getProviderId: () => {
			return typedInvokeUnwrap(VideoChannels.getProviderId);
		},
		setProviderId: (providerId) => {
			const normalizedProviderId = optionalTrimmedString(providerId);
			if (!normalizedProviderId) throw new Error('Invalid video provider id.');
			return typedInvokeUnwrap(VideoChannels.setProviderId, normalizedProviderId);
		},
		getModelId: () => {
			return typedInvokeUnwrap(VideoChannels.getModelId);
		},
		setModelId: (modelId) => {
			const normalizedModelId = optionalTrimmedString(modelId);
			if (!normalizedModelId) throw new Error('Invalid video model id.');
			return typedInvokeUnwrap(VideoChannels.setModelId, normalizedModelId);
		},
		getOptions: () => typedInvokeUnwrap(VideoChannels.getOptions),
		setOptions: (options) =>
			typedInvokeUnwrap(VideoChannels.setOptions, normalizeOptions(options) ?? {}),
	},
	voice: {
		synthesize: (request) => {
			return typedInvokeUnwrap(SpeechChannels.synthesize, normalizeSpeechSynthesisRequest(request));
		},
		getProviderId: () => {
			return typedInvokeUnwrap(SpeechChannels.getProviderId);
		},
		getOptions: () => typedInvokeUnwrap(SpeechChannels.getOptions),
		setOptions: (options) =>
			typedInvokeUnwrap(SpeechChannels.setOptions, normalizeOptions(options) ?? {}),
		setProviderId: (providerId) => {
			const normalizedProviderId = optionalTrimmedString(providerId);
			if (!normalizedProviderId) throw new Error('Invalid voice provider id.');
			return typedInvokeUnwrap(SpeechChannels.setProviderId, normalizedProviderId);
		},
		getModelId: () => {
			return typedInvokeUnwrap(SpeechChannels.getModelId);
		},
		setModelId: (modelId) => {
			const normalizedModelId = optionalTrimmedString(modelId);
			if (!normalizedModelId) throw new Error('Invalid voice model id.');
			return typedInvokeUnwrap(SpeechChannels.setModelId, normalizedModelId);
		},
	},
	realtimeVoice: {
		getSetup: () => typedInvokeUnwrap(RealtimeVoiceChannels.getSetup),
		setSetup: (request) => {
			if (!request || typeof request !== 'object' || Array.isArray(request)) {
				throw new Error('Invalid realtime voice setup.');
			}
			const providerId = optionalTrimmedString(request.providerId);
			const modelId = optionalTrimmedString(request.modelId);
			const options = normalizeOptions(request.options);
			if (!providerId) throw new Error('Invalid realtime voice provider id.');
			if (!modelId) throw new Error('Invalid realtime voice model id.');
			if (!options) throw new Error('Invalid realtime voice options.');
			return typedInvokeUnwrap(RealtimeVoiceChannels.setSetup, {
				providerId,
				modelId,
				options,
			});
		},
		startSession: (request) => {
			if (!request || typeof request !== 'object' || Array.isArray(request)) {
				throw new Error('Invalid realtime voice start request.');
			}
			const chatSessionId = optionalTrimmedString(request.chatSessionId);
			if (!chatSessionId) throw new Error('Invalid realtime voice chat session id.');
			return typedInvokeUnwrap(RealtimeVoiceChannels.startSession, { chatSessionId });
		},
		appendAudio: (sessionId, audio) => {
			const normalizedSessionId = optionalTrimmedString(sessionId);
			if (!normalizedSessionId) throw new Error('Invalid realtime voice session id.');
			if (
				typeof audio !== 'string' ||
				audio.length === 0 ||
				audio.length > REALTIME_VOICE_MAX_AUDIO_BASE64_LENGTH ||
				!/^[A-Za-z0-9+/]+={0,2}$/.test(audio)
			) {
				throw new Error('Invalid realtime voice audio chunk.');
			}
			return typedInvokeUnwrap(RealtimeVoiceChannels.appendAudio, normalizedSessionId, audio);
		},
		interruptSession: (sessionId) => {
			const normalizedSessionId = optionalTrimmedString(sessionId);
			if (!normalizedSessionId) throw new Error('Invalid realtime voice session id.');
			return typedInvokeUnwrap(RealtimeVoiceChannels.interruptSession, normalizedSessionId);
		},
		stopSession: (sessionId) => {
			const normalizedSessionId = optionalTrimmedString(sessionId);
			if (!normalizedSessionId) throw new Error('Invalid realtime voice session id.');
			return typedInvokeUnwrap(RealtimeVoiceChannels.stopSession, normalizedSessionId);
		},
		onSessionEvent: (callback) => typedOn(RealtimeVoiceChannels.sessionEvent, callback),
		getProviderId: () => typedInvokeUnwrap(RealtimeVoiceChannels.getProviderId),
		setProviderId: (providerId) => {
			const normalizedProviderId = optionalTrimmedString(providerId);
			if (!normalizedProviderId) throw new Error('Invalid realtime voice provider id.');
			return typedInvokeUnwrap(RealtimeVoiceChannels.setProviderId, normalizedProviderId);
		},
		getModelId: () => typedInvokeUnwrap(RealtimeVoiceChannels.getModelId),
		setModelId: (modelId) => {
			const normalizedModelId = optionalTrimmedString(modelId);
			if (!normalizedModelId) throw new Error('Invalid realtime voice model id.');
			return typedInvokeUnwrap(RealtimeVoiceChannels.setModelId, normalizedModelId);
		},
		getOptions: () => typedInvokeUnwrap(RealtimeVoiceChannels.getOptions),
		setOptions: (options) =>
			typedInvokeUnwrap(RealtimeVoiceChannels.setOptions, normalizeOptions(options) ?? {}),
	},
};
