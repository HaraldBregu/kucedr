import {
	buildRealtimeVoiceAdapter,
	realtimeVoiceDefaultVoice,
	realtimeVoiceModelRefs,
	supportsRealtimeVoiceModel,
	XAIRealtimeVoiceAdapter,
} from '../../../../src/main/models/adapters/realtime_voice';

describe('realtime voice adapter factory', () => {
	it('publishes the exact stable provider/model allow-list', () => {
		expect(realtimeVoiceModelRefs()).toEqual([
			{ providerId: 'openai', modelId: 'gpt-realtime-2.1' },
			{ providerId: 'openai', modelId: 'gpt-realtime-2.1-mini' },
			{ providerId: 'openai', modelId: 'gpt-live-1' },
			{ providerId: 'xai', modelId: 'grok-voice-latest' },
		]);
		expect(supportsRealtimeVoiceModel(' XAI ', 'grok-voice-latest')).toBe(true);
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
