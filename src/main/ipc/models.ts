import type { IpcModule } from './core/module';
import { ModelRenderer } from './core/model';
import type { EventBus } from '../event_bus';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import {
	EmbeddingChannels,
	ImageChannels,
	SoundChannels,
	SpeechChannels,
	RealtimeVoiceChannels,
	SttChannels,
	TextChannels,
	VideoChannels,
} from '../../shared/ipc_channels_definitions';
import { embedding, image, sound, text, video, voice } from '../models/index';
import {
	getModelId,
	getOptions,
	getProviderId,
	setModelId,
	setOptions,
	setProviderId,
} from '../models/selection';
import {
	appendRealtimeAudio,
	cancelRealtime,
	finishRealtime,
	getSelection,
	listModels,
	listProviders,
	saveSelection,
	startRealtime,
	transcribe as sttTranscribe,
} from '../models/adapters/stt';
import { getRealtimeVoiceSetup, setRealtimeVoiceSetup } from '../agent/realtime_voice/setup';

export interface ModelsIpcDependencies {
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class ModelsIpc implements IpcModule<ModelsIpcDependencies> {
	readonly name = 'models';

	register({ windows, apps }: ModelsIpcDependencies, _eventBus: EventBus): void {
		const trusted = new ModelRenderer(windows, apps);
		trusted.command(EmbeddingChannels.createEmbedding, (request) =>
			embedding.createEmbedding(request)
		);
		trusted.query(EmbeddingChannels.getProviderId, () => getProviderId('embedding'));
		trusted.command(EmbeddingChannels.setProviderId, (providerId) =>
			setProviderId('embedding', providerId)
		);
		trusted.query(EmbeddingChannels.getModelId, () => getModelId('embedding'));
		trusted.command(EmbeddingChannels.setModelId, (modelId) => setModelId('embedding', modelId));

		trusted.command(ImageChannels.createImage, (request) => image.createImage(request));
		trusted.query(ImageChannels.getProviderId, () => getProviderId('image'));
		trusted.command(ImageChannels.setProviderId, (providerId) =>
			setProviderId('image', providerId)
		);
		trusted.query(ImageChannels.getModelId, () => getModelId('image'));
		trusted.command(ImageChannels.setModelId, (modelId) => setModelId('image', modelId));
		trusted.query(ImageChannels.getOptions, () => getOptions('image'));
		trusted.command(ImageChannels.setOptions, (options) => {
			setOptions('image', options);
			return getOptions('image');
		});

		trusted.command(SoundChannels.createSound, async (request) => {
			const result = await sound.createSound(request);
			await sound.saveSoundFile(result);
			return result;
		});
		trusted.query(SoundChannels.listSounds, () => sound.listSounds());
		trusted.query(SoundChannels.getProviderId, () => getProviderId('sound'));
		trusted.command(SoundChannels.setProviderId, (providerId) =>
			setProviderId('sound', providerId)
		);
		trusted.query(SoundChannels.getModelId, () => getModelId('sound'));
		trusted.command(SoundChannels.setModelId, (modelId) => setModelId('sound', modelId));
		trusted.query(SoundChannels.getOptions, () => getOptions('sound'));
		trusted.command(SoundChannels.setOptions, (options) => {
			setOptions('sound', options);
			return getOptions('sound');
		});

		trusted.command(TextChannels.generateText, (request) => text.generateText(request));
		trusted.query(TextChannels.getProviderId, () => getProviderId('text'));
		trusted.command(TextChannels.setProviderId, (providerId) => setProviderId('text', providerId));
		trusted.query(TextChannels.getModelId, () => getModelId('text'));
		trusted.command(TextChannels.setModelId, (modelId) => setModelId('text', modelId));

		trusted.command(VideoChannels.createVideo, async (request) => {
			const result = await video.createVideo(request);
			const path = await video.saveVideoFile(result);
			return { ...result, path };
		});
		trusted.query(VideoChannels.getProviderId, () => getProviderId('video'));
		trusted.command(VideoChannels.setProviderId, (providerId) =>
			setProviderId('video', providerId)
		);
		trusted.query(VideoChannels.getModelId, () => getModelId('video'));
		trusted.command(VideoChannels.setModelId, (modelId) => setModelId('video', modelId));
		trusted.query(VideoChannels.getOptions, () => getOptions('video'));
		trusted.command(VideoChannels.setOptions, (options) => {
			setOptions('video', options);
			return getOptions('video');
		});

		trusted.command(SpeechChannels.synthesize, (request) => voice.synthesize(request));
		trusted.query(SpeechChannels.getProviderId, () => getProviderId('voice'));
		trusted.query(SpeechChannels.getOptions, () => getOptions('voice'));
		trusted.command(SpeechChannels.setOptions, (options) => {
			setOptions('voice', options);
			return getOptions('voice');
		});
		trusted.command(SpeechChannels.setProviderId, (providerId) =>
			setProviderId('voice', providerId)
		);
		trusted.query(SpeechChannels.getModelId, () => getModelId('voice'));
		trusted.command(SpeechChannels.setModelId, (modelId) => setModelId('voice', modelId));

		trusted.query(RealtimeVoiceChannels.getProviderId, () => getProviderId('realtimeVoice'));
		trusted.query(RealtimeVoiceChannels.getSetup, () => getRealtimeVoiceSetup());
		trusted.command(RealtimeVoiceChannels.setSetup, (request) => setRealtimeVoiceSetup(request));
		trusted.command(RealtimeVoiceChannels.setProviderId, (providerId) => {
			if (typeof providerId !== 'string' || !providerId.trim()) {
				throw new Error('Invalid realtime voice provider id.');
			}
			setProviderId('realtimeVoice', providerId.trim());
		});
		trusted.query(RealtimeVoiceChannels.getModelId, () => getModelId('realtimeVoice'));
		trusted.command(RealtimeVoiceChannels.setModelId, (modelId) => {
			if (typeof modelId !== 'string' || !modelId.trim()) {
				throw new Error('Invalid realtime voice model id.');
			}
			setModelId('realtimeVoice', modelId.trim());
		});
		trusted.query(RealtimeVoiceChannels.getOptions, () => getOptions('realtimeVoice'));
		trusted.command(RealtimeVoiceChannels.setOptions, (options) => {
			if (!options || typeof options !== 'object' || Array.isArray(options)) {
				throw new Error('Invalid realtime voice options.');
			}
			setOptions('realtimeVoice', { ...options });
			return getOptions('realtimeVoice');
		});

		trusted.query(SttChannels.getSelection, (mode) => getSelection(mode));
		trusted.query(SttChannels.listProviders, () => listProviders());
		trusted.query(SttChannels.listModels, (providerId) => listModels(providerId));
		trusted.command(SttChannels.saveSelection, (providerId, modelId, mode) =>
			saveSelection(providerId, modelId, mode)
		);
		trusted.query(SttChannels.getProviderId, () => getProviderId('transcribe'));
		trusted.command(SttChannels.setProviderId, (providerId) =>
			setProviderId('transcribe', providerId)
		);
		trusted.query(SttChannels.getModelId, () => getModelId('transcribe'));
		trusted.command(SttChannels.setModelId, (modelId) => setModelId('transcribe', modelId));
		trusted.command(SttChannels.transcribe, (request) => sttTranscribe(request));
		trusted.commandWithEvent(SttChannels.startRealtime, (event, request) =>
			startRealtime(request, (sttEvent) => {
				event.sender.send(SttChannels.realtimeEvent, sttEvent);
			})
		);
		trusted.command(SttChannels.appendRealtimeAudio, (sessionId, audio) =>
			appendRealtimeAudio(sessionId, audio)
		);
		trusted.command(SttChannels.finishRealtime, (sessionId) => finishRealtime(sessionId));
		trusted.command(SttChannels.cancelRealtime, (sessionId) => cancelRealtime(sessionId));
	}
}
