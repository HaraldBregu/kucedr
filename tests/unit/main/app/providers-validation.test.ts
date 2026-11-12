import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
	parseProviderManifest,
	validateProviderManifest,
} from '../../../../src/shared/providers/validation';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';

describe('provider manifest validation', () => {
	it('rejects invalid model types and accepts capability sections', () => {
		const manifest = {
			providerId: 'acme',
			providerName: 'Acme',
			authentication: 'api-key',
			models: [
				{
					id: 'acme-chat',
					name: 'Acme Chat',
					type: 'large-language-model',
					location: 'remote',
					authentication: 'api-key',
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
				models: [
					{
						id: 'voice-realtime',
						name: 'Voice Realtime',
						type: 'realtime-voice-model',
						location: 'remote',
						authentication: 'api-key',
						url: 'https://api.voice.test/v1',
					},
				],
			})
		).toBeDefined();
		expect(
			parseProviderManifest({
				providerId: 'notion',
				providerName: 'Notion',
				mcp_servers: [
					{
						id: 'notion-mcp',
						name: 'Notion MCP',
						authentication: 'oauth2',
						url: 'https://mcp.notion.com/mcp',
						scopes: [],
					},
				],
			})
		).toBeDefined();
		expect(
			validateProviderManifest({
				...manifest,
				models: [{ ...manifest.models[0], type: 'chat' }],
			})
		).toEqual([expect.stringContaining('models[0].type must be one of')]);
	});

	it('accepts service icons from the provider image folder', () => {
		const manifest = {
			providerId: 'google',
			providerName: 'Google',
			mcp_servers: [
				{
					id: 'gmail',
					name: 'Gmail',
					authentication: 'oauth2',
					url: 'https://gmailmcp.googleapis.com/mcp/v1',
					scopes: ['https://www.googleapis.com/auth/gmail.modify'],
					icon_dark_url: '/images/gmail.svg',
					icon_light_url: '/images/gmail.svg',
				},
			],
		};

		expect(parseProviderManifest(manifest)).toEqual(manifest);
		expect(
			validateProviderManifest({
				...manifest,
				mcp_servers: [{ ...manifest.mcp_servers[0], icon_dark_url: '../gmail.svg' }],
			})
		).toContainEqual(expect.stringContaining('mcp_servers[0].icon_dark_url'));
	});

	it('requires vector database arrays and validates storage presets', () => {
		const manifest = {
			providerId: 'acme',
			providerName: 'Acme',
			vector_databases: [
				{
					id: 'db',
					name: 'Database',
					authentication: 'api-key',
					url: 'https://db.acme.test',
				},
			],
			storage: {
				id: 'files',
				name: 'Files',
				authentication: 's3-access-key',
				metadata: { protocol: 's3', region: 'auto' },
			},
		};
		expect(validateProviderManifest(manifest)).toEqual([]);
		expect(
			validateProviderManifest({ ...manifest, vector_databases: { ...manifest.vector_databases[0] } })
		).toContainEqual(expect.stringContaining('"vector_databases" must be an array'));
		expect(
			validateProviderManifest({ ...manifest, databases: manifest.vector_databases })
		).toContainEqual(expect.stringContaining('use "vector_databases"'));
		expect(
			validateProviderManifest({
				...manifest,
				storage: { ...manifest.storage, metadata: { protocol: 'unknown' } },
			})
		).toContainEqual(expect.stringContaining('storage.metadata.protocol'));
	});

	it('accepts supported authentication types and rejects unknown ones', () => {
		const manifest = {
			providerId: 'example',
			providerName: 'Example',
			authentication: 'api-key',
			mcp_servers: [
				{
					id: 'example-mcp',
					name: 'Example MCP',
					url: 'https://example.com/mcp',
					authentication: 'oauth2',
					scopes: [],
				},
			],
		};
		expect(validateProviderManifest(manifest)).toEqual([]);
		expect(validateProviderManifest({ ...manifest, authentication: 'password' })).toContainEqual(
			expect.stringContaining('"authentication" must be one of')
		);
		expect(
			validateProviderManifest({
				...manifest,
				mcp_servers: [{ ...manifest.mcp_servers[0], authentication: 'password' }],
			})
		).toContainEqual(expect.stringContaining('mcp_servers[0].authentication must be one of'));
	});
	it('requires valid MCP scopes and OAuth metadata', () => {
		const server = {
			id: 'example',
			name: 'Example',
			url: 'https://example.com/mcp',
			authentication: 'oauth2',
			scopes: ['mcp'],
		};
		const manifest = { providerId: 'example', providerName: 'Example', mcp_servers: [server] };
		expect(validateProviderManifest(manifest)).toEqual([]);
		expect(
			validateProviderManifest({ ...manifest, mcp_servers: [{ ...server, scopes: ['mcp read'] }] })
		).toContainEqual(expect.stringContaining('mcp_servers[0].scopes'));
		expect(
			validateProviderManifest({
				...manifest,
				mcp_servers: [{ ...server, oauth: { google_fetch: 'yes' } }],
			})
		).toContainEqual(expect.stringContaining('mcp_servers[0].oauth.google_fetch'));
		expect(
			validateProviderManifest({
				...manifest,
				mcp_servers: [{ ...server, oauth: { authorization_params: { state: 'fixed' } } }],
			})
		).toContainEqual(expect.stringContaining('mcp_servers[0].oauth.authorization_params'));
	});

	it.each(['large-language-model', 'research-chat-model'])(
		'requires prompt attachment metadata for %s models',
		(type) => {
			const errors = validateProviderManifest({
				providerId: 'acme',
				providerName: 'Acme',
				models: [{ id: 'chat', name: 'Chat', type, url: 'https://api.acme.test' }],
			});

			expect(errors).toContainEqual(expect.stringContaining('metadata must be an object'));
		}
	);

	it('requires promptAttachments when prompt model metadata exists', () => {
		const errors = validateProviderManifest({
			providerId: 'acme',
			providerName: 'Acme',
			models: [
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

	it.each([null, [], { broken: null }, { broken: { endpoint: '/run', description: 'Run', inputSchema: null } }])(
		'rejects malformed model operations: %p',
		(operations) => {
			const errors = validateProviderManifest({
				providerId: 'acme', providerName: 'Acme',
				models: [{ id: 'model', name: 'Model', type: 'decision-model', url: 'https://api.acme.test', authentication: 'api-key', location: 'remote', metadata: { operations } }],
			});
			expect(errors).toContainEqual(expect.stringContaining('metadata.operations'));
		}
	);

	it('rejects empty MCP server descriptions', () => {
		const errors = validateProviderManifest({
			providerId: 'acme',
			providerName: 'Acme',
			mcp_servers: [
				{
					id: 'acme-mcp',
					name: 'Acme MCP',
					description: '',
					authentication: 'oauth2',
					url: 'https://mcp.acme.test',
				},
			],
		});

		expect(errors).toContainEqual(expect.stringContaining('mcp_servers[0].description'));
	});

	it('requires promptAttachments to be an array', () => {
		const errors = validateProviderManifest({
			providerId: 'acme',
			providerName: 'Acme',
			models: [
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
				models: [
					{
						id: 'chat',
						name: 'Chat',
						type: 'large-language-model',
						location: 'remote',
						authentication: 'api-key',
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
			models: [
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

	it('validates attachment contracts for every bundled prompt model', () => {
		const pluginsDirectory = join(process.cwd(), 'resources', 'plugins');
		const promptModels = readdirSync(pluginsDirectory, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.flatMap((entry) => {
				const plugin = readPlugin(join(pluginsDirectory, entry.name), entry.name, true);
				if (!plugin.provider) return [];
				expect(validateProviderManifest(plugin.provider)).toEqual([]);
				return (plugin.provider.models ?? []).filter((model) =>
					['large-language-model', 'research-chat-model'].includes(model.type)
				);
			});
		expect(promptModels.length).toBeGreaterThan(0);
		for (const model of promptModels) expect(Array.isArray(model.metadata?.promptAttachments)).toBe(true);
	});
});
