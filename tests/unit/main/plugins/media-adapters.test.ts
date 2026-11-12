import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { loadModels } from '../../../../src/main/models';
import { buildSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_factory';
import { buildMusicAdapter } from '../../../../src/main/models/adapters/tta/tta_factory';
import { buildVideoAdapter } from '../../../../src/main/models/adapters/ttv/ttv_factory';
import { buildRealtimeVoiceAdapter } from '../../../../src/main/models/adapters/realtime_voice/realtime_voice_factory';

jest.mock('@mistralai/mistralai', () => ({ Mistral: jest.fn() }));
jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => ['openai', 'elevenlabs', 'xai'].map((id) => {
		const directory = path.resolve('resources/plugins', id);
		const plugin = readPlugin(directory, id, true);
		return { directory, manifest: plugin.provider, plugin: { id, name: plugin.title } };
	}),
}));

it('constructs the appropriate adapter for every bundled speech, audio, video and realtime model', () => {
	const models = loadModels();
	for (const model of models) {
		const provider = { id: model.provider.id, name: model.provider.name, apiKey: 'key', baseURL: model.url ?? '' };
		if (model.type === 'text-to-speech') expect(buildSpeechAdapter(provider).synthesize).toEqual(expect.any(Function));
		if (model.type === 'text-to-audio') expect(buildMusicAdapter(provider).generate).toEqual(expect.any(Function));
		if (model.type === 'text-to-video') expect(buildVideoAdapter(provider).generate).toEqual(expect.any(Function));
		if (model.type === 'realtime-voice') expect(buildRealtimeVoiceAdapter(provider, model).connect).toEqual(expect.any(Function));
	}
	expect(models.filter((model) => ['text-to-speech', 'text-to-audio', 'text-to-video', 'realtime-voice'].includes(model.type))).toHaveLength(23);
});
