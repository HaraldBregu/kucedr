import { loadDatabases, loadModels, loadWebSearches } from '../../../../src/main/models';

function namesAreAlphabetical(entries: readonly { name: string }[]): boolean {
	return entries.every(
		(entry, index) => index === 0 || entries[index - 1].name.localeCompare(entry.name) <= 0
	);
}

describe('provider manifests', () => {
	it('routes manifest services to their matching catalog', () => {
		const openAi = loadModels().find(
			(model) => model.provider.id === 'openai' && model.id === 'gpt-5.6-sol'
		);
		const deepseek = loadModels().find(
			(model) => model.provider.id === 'deepseek' && model.id === 'deepseek-v4-flash'
		);
		const openAiRealtime = loadModels().filter(
			(model) => model.provider.id === 'openai' && model.type === 'realtime-voice'
		);
		const providersById = new Map(
			[...loadModels(), ...loadDatabases(), ...loadWebSearches()].map(
				(model) => [model.provider.id, model.provider] as const
			)
		);
		const realtimeVoiceModels = loadModels().filter((model) => model.type === 'realtime-voice');
		expect(openAi?.provider.iconDarkUrl).toMatch(/^local-resource:\/\/file/);
		expect(openAi?.provider.iconDarkUrl).toContain(
			'/resources/providers/openai/images/fallback_lobehub/png_dark/openai.png'
		);
		expect(openAi?.provider.iconLightUrl).toMatch(/^local-resource:\/\/file/);
		expect(openAi?.provider.iconLightUrl).toContain(
			'/resources/providers/openai/images/fallback_lobehub/png_light/openai.png'
		);
		expect(providersById.get('reka')?.iconDarkUrl).toContain(
			'/resources/providers/reka/images/official/reka-dark.jpg'
		);
		expect(providersById.get('reka')?.iconLightUrl).toContain(
			'/resources/providers/reka/images/official/reka-light.jpg'
		);
		expect(providersById.get('pika')?.iconDarkUrl).toContain(
			'/resources/providers/pika/images/fallback_lobehub/png_dark/pika.png'
		);
		expect(providersById.get('pika')?.iconLightUrl).toContain(
			'/resources/providers/pika/images/fallback_lobehub/png_light/pika.png'
		);
		expect(providersById.get('jina')?.iconDarkUrl).toContain(
			'/resources/providers/jina/images/official/jina-white.png'
		);
		expect(providersById.get('jina')?.iconLightUrl).toContain(
			'/resources/providers/jina/images/official/jina-color.png'
		);
		expect(providersById.get('deepgram')?.iconDarkUrl).toContain(
			'/resources/providers/deepgram/images/official/deepgram-dark.svg'
		);
		expect(providersById.get('deepgram')?.iconLightUrl).toContain(
			'/resources/providers/deepgram/images/official/deepgram-light.svg'
		);
		expect(providersById.get('brave')?.iconDarkUrl).toContain(
			'/resources/providers/brave/images/official/brave-search.svg'
		);
		expect(providersById.get('brave')?.iconLightUrl).toContain(
			'/resources/providers/brave/images/official/brave-search.svg'
		);
		expect(providersById.get('tavily')?.iconDarkUrl).toContain(
			'/resources/providers/tavily/images/official/tavily-offwhite.svg'
		);
		expect(providersById.get('tavily')?.iconLightUrl).toContain(
			'/resources/providers/tavily/images/official/tavily-black.svg'
		);
		expect(providersById.get('pinecone')).toEqual(
			expect.objectContaining({
				id: 'pinecone',
				name: 'Pinecone',
				apiKeyUrl: 'https://app.pinecone.io',
			})
		);
		expect(loadModels().some((model) => model.provider.id === 'pinecone')).toBe(false);
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
			{ id: 'gpt-realtime-2.1', providerId: 'openai' },
			{ id: 'gpt-realtime-2.1-mini', providerId: 'openai' },
			{ id: 'gpt-live-1', providerId: 'openai' },
			{ id: 'grok-voice-latest', providerId: 'xai' },
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
					id: 'brave-web-search',
					provider: expect.objectContaining({ id: 'brave' }),
				}),
			])
		);
		expect(loadDatabases()).toEqual([
			expect.objectContaining({
				id: 'pinecone',
				name: 'Pinecone Vector Database',
				type: 'database',
				url: 'https://api.pinecone.io',
				provider: expect.objectContaining({ id: 'pinecone' }),
			}),
		]);
		expect(namesAreAlphabetical(loadModels())).toBe(true);
		expect(namesAreAlphabetical(loadDatabases())).toBe(true);
		expect(namesAreAlphabetical(loadWebSearches())).toBe(true);
	});
});
