import { loadModels, loadWebSearches } from '../../../../src/main/models';

function namesAreAlphabetical(entries: readonly { name: string }[]): boolean {
	return entries.every(
		(entry, index) => index === 0 || entries[index - 1].name.localeCompare(entry.name) <= 0
	);
}

describe('provider manifests', () => {
	it('routes manifest capabilities to their matching catalog', () => {
		const openAi = loadModels().find(
			(model) => model.provider.id === 'openai' && model.id === 'gpt-5.6-sol'
		);
		const deepseek = loadModels().find(
			(model) => model.provider.id === 'deepseek' && model.id === 'deepseek-flash'
		);
		const openAiRealtime = loadModels().filter(
			(model) => model.provider.id === 'openai' && model.type === 'realtime-voice'
		);
		const providersById = new Map(
			[...loadModels(), ...loadWebSearches()].map(
				(model) => [model.provider.id, model.provider] as const
			)
		);
		const realtimeVoiceModels = loadModels().filter((model) => model.type === 'realtime-voice');
		expect(
			[...providersById.values()].every(
				(provider) =>
					(!provider.iconDarkUrl || provider.iconDarkUrl.endsWith('.svg')) &&
					(!provider.iconLightUrl || provider.iconLightUrl.endsWith('.svg'))
			)
		).toBe(true);
		expect(openAi?.provider.iconDarkUrl).toMatch(/^local-resource:\/\/file/);
		expect(openAi?.provider.iconDarkUrl).toContain(
			'/resources/plugins/openai/assets/openai-dark.svg'
		);
		expect(openAi?.provider.iconLightUrl).toMatch(/^local-resource:\/\/file/);
		expect(openAi?.provider.iconLightUrl).toContain(
			'/resources/plugins/openai/assets/openai-light.svg'
		);
		expect(providersById.get('deepgram')?.iconDarkUrl).toContain(
			'/resources/plugins/deepgram/assets/deepgram.svg'
		);
		expect(providersById.get('deepgram')?.iconLightUrl).toContain(
			'/resources/plugins/deepgram/assets/deepgram.svg'
		);
		expect(providersById.get('brave')?.iconDarkUrl).toContain(
			'/resources/plugins/brave/assets/brave.svg'
		);
		expect(providersById.get('brave')?.iconLightUrl).toContain(
			'/resources/plugins/brave/assets/brave.svg'
		);
		expect(providersById.get('tavily')?.iconDarkUrl).toContain(
			'/resources/plugins/tavily/assets/tavily.svg'
		);
		expect(providersById.get('tavily')?.iconLightUrl).toContain(
			'/resources/plugins/tavily/assets/tavily.svg'
		);
		expect(deepseek?.metadata).toEqual(
			expect.objectContaining({ contextWindow: 1_048_576, defaultOutputTokens: 32_768 })
		);
		expect(openAiRealtime).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: 'gpt-realtime-2.1',
					default: true,
					sampleRate: 24_000,
					metadata: expect.objectContaining({
						documentationStatus: 'verified',
						inputs: expect.objectContaining({
							voice: expect.objectContaining({ default: 'marin' }),
						}),
					}),
				}),
				expect.objectContaining({ id: 'gpt-realtime-2.1-mini', sampleRate: 24_000 }),
				expect.objectContaining({ id: 'gpt-live-1', sampleRate: 24_000 }),
			])
		);
		expect(
			realtimeVoiceModels.map((model) => ({ id: model.id, providerId: model.provider.id }))
		).toEqual([
			{ id: 'gpt-live-1', providerId: 'openai' },
			{ id: 'gpt-realtime-2.1', providerId: 'openai' },
			{ id: 'gpt-realtime-2.1-mini', providerId: 'openai' },
			{ id: 'grok-voice-latest', providerId: 'xai' },
			{ id: 'voice-agent', providerId: 'deepgram' },
		]);
		expect(realtimeVoiceModels).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: 'grok-voice-latest',
					sampleRate: 24_000,
					metadata: expect.objectContaining({
						documentationStatus: 'verified',
						inputs: expect.objectContaining({
							voice: expect.objectContaining({ default: 'eve' }),
						}),
					}),
				}),
			])
		);
		expect(loadModels().map((model) => model.id)).not.toEqual(
			expect.arrayContaining([
				'gemini-3.1-flash-live-preview',
				'qwen-omni-realtime',
				'qwen3.5-omni',
				'qwen3-omni-flash',
			])
		);
		expect(loadWebSearches()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: 'web-search',
					provider: expect.objectContaining({ id: 'brave' }),
				}),
			])
		);
		expect(namesAreAlphabetical(loadModels())).toBe(true);
		expect(namesAreAlphabetical(loadWebSearches())).toBe(true);
	});
});
