import { loadDatabases, loadMcps, loadModels, loadWebSearches } from '../../../../src/main/models';

function namesAreAlphabetical(entries: readonly { name: string }[]): boolean {
	return entries.every(
		(entry, index) => index === 0 || entries[index - 1].name.localeCompare(entry.name) <= 0
	);
}

describe('provider manifests', () => {
	it('routes manifest services to their matching catalog', () => {
		const integrations = loadMcps().filter((service) =>
			[
				'gmail',
				'google-calendar',
				'google-contacts',
				'google-docs',
				'google-drive',
				'google-maps',
				'google-sheets',
				'github',
				'gitlab',
				'microsoft-learn',
				'notion',
			].includes(service.id)
		);
		const openAi = loadModels().find(
			(model) => model.provider.id === 'openai' && model.id === 'gpt-5.6-sol'
		);
		const google = loadModels().find(
			(model) => model.provider.id === 'google' && model.id === 'gemini-3.1-pro-preview'
		);
		const deepseek = loadModels().find(
			(model) => model.provider.id === 'deepseek' && model.id === 'deepseek-flash'
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
		const iconProviders = [
			...providersById.values(),
			...integrations.map((service) => service.provider),
		];
		expect(
			iconProviders.every(
				(provider) =>
					(!provider.iconDarkUrl || provider.iconDarkUrl.endsWith('.svg')) &&
					(!provider.iconLightUrl || provider.iconLightUrl.endsWith('.svg'))
			)
		).toBe(true);
		expect(openAi?.provider.iconDarkUrl).toMatch(/^local-resource:\/\/file/);
		expect(google?.provider.name).toBe('Google DeepMind / Google');
		expect(integrations.map((service) => service.provider.id)).toEqual([
			'github',
			'gitlab',
			'google',
			'google',
			'google',
			'google',
			'google',
			'google',
			'google',
			'microsoft',
			'notion',
		]);
		expect(integrations.map((service) => service.id)).toEqual([
			'github',
			'gitlab',
			'gmail',
			'google-calendar',
			'google-contacts',
			'google-docs',
			'google-drive',
			'google-maps',
			'google-sheets',
			'microsoft-learn',
			'notion',
		]);
		expect(integrations.map((service) => service.url)).toEqual([
			'https://api.githubcopilot.com/mcp/',
			'https://gitlab.com/api/v4/mcp',
			'https://gmailmcp.googleapis.com/mcp/v1',
			'https://calendarmcp.googleapis.com/mcp/v1',
			'https://people.googleapis.com/mcp/v1',
			'https://docsmcp.googleapis.com/mcp/v1',
			'https://drivemcp.googleapis.com/mcp/v1',
			'https://mapstools.googleapis.com/mcp',
			'https://sheetsmcp.googleapis.com/mcp/v1',
			'https://learn.microsoft.com/api/mcp',
			'https://mcp.notion.com/mcp',
		]);
		expect(integrations.map((service) => service.description)).toEqual([
			'Work with repositories and issues.',
			'Work with projects, issues, and merge requests.',
			'Search and manage email.',
			'Manage calendars and events.',
			'Search contacts and directory profiles.',
			'Read and update documents.',
			'Search and manage Drive files.',
			'Find places, routes, and weather.',
			'Read and update spreadsheets.',
			'Search Microsoft documentation and code samples.',
			'Search and manage Notion pages.',
		]);
		expect(integrations.every((service) => service.iconLightUrl?.endsWith('.svg'))).toBe(true);
		for (const id of [
			'gmail',
			'google-calendar',
			'google-contacts',
			'google-docs',
			'google-drive',
			'google-maps',
			'google-sheets',
		]) {
			const service = integrations.find((entry) => entry.id === id);
			const iconName = id === 'google-contacts' ? 'google-contact' : id;
			expect(service?.iconDarkUrl).toContain(`/resources/providers/google/images/${iconName}.svg`);
			expect(service?.iconLightUrl).toContain(`/resources/providers/google/images/${iconName}.svg`);
		}
		expect(integrations.find((service) => service.id === 'gitlab')?.iconLightUrl).toContain(
			'/resources/providers/gitlab/images/gitlab.svg'
		);
		expect(integrations.find((service) => service.id === 'microsoft-learn')?.iconLightUrl).toContain(
			'/resources/providers/microsoft/images/microsoft.svg'
		);
		expect(integrations.find((service) => service.provider.id === 'github')?.provider).toEqual(
			expect.objectContaining({
				iconDarkUrl: expect.stringContaining('/resources/providers/github/images/github-dark.svg'),
				iconLightUrl: expect.stringContaining(
					'/resources/providers/github/images/github-light.svg'
				),
			})
		);
		expect(google?.provider.iconDarkUrl).toContain('/resources/providers/google/images/google.svg');
		expect(
			integrations.find((service) => service.id === 'notion')?.provider.iconLightUrl
		).toContain('/resources/providers/notion/images/notion.svg');
		expect(openAi?.provider.iconDarkUrl).toContain(
			'/resources/providers/openai/images/openai-dark.svg'
		);
		expect(openAi?.provider.iconLightUrl).toMatch(/^local-resource:\/\/file/);
		expect(openAi?.provider.iconLightUrl).toContain(
			'/resources/providers/openai/images/openai-light.svg'
		);
		expect(providersById.get('reka')?.iconDarkUrl).toContain(
			'/resources/providers/reka/images/reka-dark.svg'
		);
		expect(providersById.get('reka')?.iconLightUrl).toContain(
			'/resources/providers/reka/images/reka-light.svg'
		);
		expect(providersById.get('pika')?.iconDarkUrl).toContain(
			'/resources/providers/pika/images/pika-dark.svg'
		);
		expect(providersById.get('pika')?.iconLightUrl).toContain(
			'/resources/providers/pika/images/pika-light.svg'
		);
		expect(providersById.get('jina')?.iconDarkUrl).toContain(
			'/resources/providers/jina/images/jina-dark.svg'
		);
		expect(providersById.get('jina')?.iconLightUrl).toContain(
			'/resources/providers/jina/images/jina-light.svg'
		);
		expect(providersById.get('deepgram')?.iconDarkUrl).toContain(
			'/resources/providers/deepgram/images/deepgram-dark.svg'
		);
		expect(providersById.get('deepgram')?.iconLightUrl).toContain(
			'/resources/providers/deepgram/images/deepgram-light.svg'
		);
		expect(providersById.get('brave')?.iconDarkUrl).toContain(
			'/resources/providers/brave/images/brave-search.svg'
		);
		expect(providersById.get('brave')?.iconLightUrl).toContain(
			'/resources/providers/brave/images/brave-search.svg'
		);
		expect(providersById.get('tavily')?.iconDarkUrl).toContain(
			'/resources/providers/tavily/images/tavily-offwhite.svg'
		);
		expect(providersById.get('tavily')?.iconLightUrl).toContain(
			'/resources/providers/tavily/images/tavily-black.svg'
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
			{ id: 'gpt-live-1', providerId: 'openai' },
			{ id: 'gpt-realtime-2.1', providerId: 'openai' },
			{ id: 'gpt-realtime-2.1-mini', providerId: 'openai' },
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
