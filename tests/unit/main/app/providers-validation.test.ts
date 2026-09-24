import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	parseProviderManifest,
	validateProviderManifest,
} from '../../../../src/shared/providers/validation';

const IMAGE_RULE = {
	kind: 'image',
	mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
	extensions: ['.jpg', '.jpeg', '.png', '.webp'],
};
const PDF_RULE = {
	kind: 'document',
	mimeTypes: ['application/pdf'],
	extensions: ['.pdf'],
};

function expectedPromptAttachments(providerId: string, modelId: string): unknown[] {
	if (['anthropic', 'openai', 'reka'].includes(providerId)) {
		return [IMAGE_RULE, PDF_RULE];
	}
	if (['google', 'kimi', 'xai'].includes(providerId)) return [IMAGE_RULE];
	if (providerId === 'mistral' && modelId !== 'devstral-2512') return [IMAGE_RULE];
	if (providerId === 'qwen' && modelId !== 'qwen3.7-max') return [IMAGE_RULE];
	return [];
}

describe('provider manifest validation', () => {
	it('rejects invalid service types and accepts supported manifest services', () => {
		const manifest = {
			providerId: 'acme',
			providerName: 'Acme',
			services: [
				{
					id: 'acme-chat',
					name: 'Acme Chat',
					type: 'large-language-model',
					url: 'https://api.acme.test/v1',
					metadata: {
						documentationUrl: 'https://docs.acme.test/chat',
						inputs: {},
						promptAttachments: [],
					},
				},
			],
		};

		expect(parseProviderManifest(manifest)).toEqual(manifest);
		expect(
			parseProviderManifest({
				providerId: 'voice',
				providerName: 'Voice',
				services: [
					{
						id: 'voice-realtime',
						name: 'Voice Realtime',
						type: 'realtime-voice-model',
						url: 'https://api.voice.test/v1',
					},
				],
			})
		).toBeDefined();
		expect(
			parseProviderManifest({
				providerId: 'notion',
				providerName: 'Notion',
				services: [
					{ id: 'notion-mcp', name: 'Notion MCP', type: 'mcp', url: 'https://mcp.notion.com/mcp' },
				],
			})
		).toBeDefined();
		expect(
			validateProviderManifest({
				...manifest,
				services: [{ ...manifest.services[0], type: 'chat' }],
			})
		).toEqual([expect.stringContaining('services[0].type must be one of')]);
	});

	it('accepts service icons from the provider image folder', () => {
		const manifest = {
			providerId: 'google',
			providerName: 'Google',
			services: [
				{
					id: 'gmail',
					name: 'Gmail',
					type: 'mcp',
					url: 'https://gmailmcp.googleapis.com/mcp/v1',
					icon_dark_url: '/images/official/gmail.svg',
					icon_light_url: '/images/official/gmail.svg',
				},
			],
		};

		expect(parseProviderManifest(manifest)).toEqual(manifest);
		expect(
			validateProviderManifest({
				...manifest,
				services: [{ ...manifest.services[0], icon_dark_url: '../gmail.svg' }],
			})
		).toContainEqual(expect.stringContaining('services[0].icon_dark_url'));
	});

	it.each(['large-language-model', 'research-chat-model'])(
		'requires prompt attachment metadata for %s services',
		(type) => {
			const errors = validateProviderManifest({
				providerId: 'acme',
				providerName: 'Acme',
				services: [{ id: 'chat', name: 'Chat', type, url: 'https://api.acme.test' }],
			});

			expect(errors).toContainEqual(expect.stringContaining('metadata must be an object'));
		}
	);

	it('requires promptAttachments when prompt model metadata exists', () => {
		const errors = validateProviderManifest({
			providerId: 'acme',
			providerName: 'Acme',
			services: [
				{
					id: 'chat',
					name: 'Chat',
					type: 'large-language-model',
					url: 'https://api.acme.test',
					metadata: { inputs: {} },
				},
			],
		});

		expect(errors).toContainEqual(expect.stringContaining('promptAttachments must be declared'));
	});

	it('rejects empty service descriptions', () => {
		const errors = validateProviderManifest({
			providerId: 'acme',
			providerName: 'Acme',
			services: [
				{
					id: 'acme-mcp',
					name: 'Acme MCP',
					description: '',
					type: 'mcp',
					url: 'https://mcp.acme.test',
				},
			],
		});

		expect(errors).toContainEqual(expect.stringContaining('services[0].description'));
	});

	it('requires promptAttachments to be an array', () => {
		const errors = validateProviderManifest({
			providerId: 'acme',
			providerName: 'Acme',
			services: [
				{
					id: 'chat',
					name: 'Chat',
					type: 'large-language-model',
					url: 'https://api.acme.test',
					metadata: { promptAttachments: {} },
				},
			],
		});

		expect(errors).toContainEqual(expect.stringContaining('promptAttachments must be an array'));
	});

	it('accepts deeply valid prompt attachment rules', () => {
		expect(
			validateProviderManifest({
				providerId: 'acme',
				providerName: 'Acme',
				services: [
					{
						id: 'chat',
						name: 'Chat',
						type: 'large-language-model',
						url: 'https://api.acme.test',
						metadata: {
							promptAttachments: [
								{
									kind: 'image',
									mimeTypes: ['image/jpeg', 'image/png'],
									extensions: ['.jpg', '.jpeg', '.png'],
									maxFiles: 3,
									maxBytes: 20 * 1024 * 1024,
									maxTotalBytes: 50 * 1024 * 1024,
								},
							],
						},
					},
				],
			})
		).toEqual([]);
	});

	it.each([
		[
			'unsupported kind',
			{ kind: 'archive', mimeTypes: ['application/zip'], extensions: ['.zip'] },
			'kind',
		],
		['missing MIME array', { kind: 'image', extensions: ['.png'] }, 'mimeTypes'],
		['empty MIME array', { kind: 'image', mimeTypes: [], extensions: ['.png'] }, 'mimeTypes'],
		['invalid MIME', { kind: 'image', mimeTypes: ['image'], extensions: ['.png'] }, 'mimeTypes[0]'],
		['missing extension array', { kind: 'image', mimeTypes: ['image/png'] }, 'extensions'],
		[
			'empty extension array',
			{ kind: 'image', mimeTypes: ['image/png'], extensions: [] },
			'extensions',
		],
		[
			'uppercase extension',
			{ kind: 'image', mimeTypes: ['image/png'], extensions: ['.PNG'] },
			'extensions[0]',
		],
		[
			'extension without dot',
			{ kind: 'image', mimeTypes: ['image/png'], extensions: ['png'] },
			'extensions[0]',
		],
		[
			'zero file limit',
			{ kind: 'image', mimeTypes: ['image/png'], extensions: ['.png'], maxFiles: 0 },
			'maxFiles',
		],
		[
			'fractional byte limit',
			{ kind: 'image', mimeTypes: ['image/png'], extensions: ['.png'], maxBytes: 1.5 },
			'maxBytes',
		],
		[
			'negative total limit',
			{ kind: 'image', mimeTypes: ['image/png'], extensions: ['.png'], maxTotalBytes: -1 },
			'maxTotalBytes',
		],
	])('rejects %s', (_label, rule, expectedPath) => {
		const errors = validateProviderManifest({
			providerId: 'acme',
			providerName: 'Acme',
			services: [
				{
					id: 'chat',
					name: 'Chat',
					type: 'large-language-model',
					url: 'https://api.acme.test',
					metadata: { promptAttachments: [rule] },
				},
			],
		});

		expect(errors).toContainEqual(expect.stringContaining(expectedPath));
	});

	it('declares the expected attachment contract for every bundled prompt model', () => {
		const providersDirectory = join(process.cwd(), 'resources', 'providers');
		const manifests = readdirSync(providersDirectory, { withFileTypes: true })
			.filter(
				(entry) =>
					entry.isDirectory() && existsSync(join(providersDirectory, entry.name, 'manifest.json'))
			)
			.map((entry) =>
				JSON.parse(readFileSync(join(providersDirectory, entry.name, 'manifest.json'), 'utf8'))
			);
		const promptModels = manifests.flatMap((manifest) => {
			expect(validateProviderManifest(manifest)).toEqual([]);
			return manifest.services
				.filter((service: { type: string }) =>
					['large-language-model', 'research-chat-model'].includes(service.type)
				)
				.map((service: { id: string; metadata: { promptAttachments: unknown[] } }) => ({
					providerId: manifest.providerId as string,
					service,
				}));
		});

		expect(promptModels).toHaveLength(40);
		for (const { providerId, service } of promptModels) {
			expect(service.metadata.promptAttachments).toEqual(
				expectedPromptAttachments(providerId, service.id)
			);
		}
	});
});
