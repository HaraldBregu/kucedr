import {
	buildRealtimeVoiceAdapter,
	realtimeVoiceDefaultVoice,
	realtimeVoiceModelRefs,
	supportsRealtimeVoiceModel,
	supportsRealtimeVoiceTools,
	XAIRealtimeVoiceAdapter,
} from '../../../../src/main/models/adapters/realtime_voice';

describe('realtime voice adapter factory', () => {
	it('covers every realtime voice model in the bundled provider catalog', () => {
		const root = path.resolve(__dirname, '../../../../resources/providers');
		const catalog = fs.readdirSync(root).flatMap((providerId) => {
			const manifestPath = path.join(root, providerId, 'manifest.json');
			if (!fs.existsSync(manifestPath)) return [];
			const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
			return manifest.models
				.filter((model: { type: string }) => model.type === 'realtime-voice-model')
				.map((model: { id: string }) => ({ providerId, modelId: model.id }));
		});
		expect(realtimeVoiceModelRefs()).toEqual(expect.arrayContaining(catalog));
		expect(realtimeVoiceModelRefs()).toHaveLength(catalog.length);
	});
	it('publishes the exact stable provider/model allow-list', () => {
		expect(realtimeVoiceModelRefs()).toEqual([
			{ providerId: 'openai', modelId: 'gpt-realtime-2.1' },
			{ providerId: 'openai', modelId: 'gpt-realtime-2.1-mini' },
			{ providerId: 'openai', modelId: 'gpt-live-1' },
			{ providerId: 'xai', modelId: 'grok-voice-latest' },
		]);
		expect(supportsRealtimeVoiceModel(' XAI ', 'grok-voice-latest')).toBe(true);
		expect(supportsRealtimeVoiceTools('openai', 'gpt-realtime-2.1')).toBe(true);
		expect(supportsRealtimeVoiceTools('xai', 'grok-voice-latest')).toBe(true);
		expect(supportsRealtimeVoiceTools('openai', 'gpt-live-1')).toBe(false);
		expect(supportsRealtimeVoiceModel('google', 'gemini-3.1-flash-live-preview')).toBe(false);
		expect(supportsRealtimeVoiceModel('qwen', 'qwen3.5-omni')).toBe(false);
		expect(realtimeVoiceDefaultVoice(' XAI ')).toBe('eve');
	});

	it('builds a provider-specific adapter and rejects unknown providers', () => {
		expect(buildRealtimeVoiceAdapter({ id: ' XAI ', name: 'xAI', apiKey: 'key' })).toBeInstanceOf(
			XAIRealtimeVoiceAdapter
		);
		expect(() =>
			buildRealtimeVoiceAdapter({ id: 'google', name: 'Google', apiKey: 'key' })
		).toThrow('not supported');
	});
});
import fs from 'node:fs';
import path from 'node:path';
