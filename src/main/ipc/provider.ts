import type {
	ChannelCredentialSaveInput,
	ChannelCredentialSummary,
	StoredChannelProvider,
} from '../../shared/channels_types';
import { CHANNEL_DM_POLICIES } from '../../shared/channels_types';
import type {
	ProviderCredentialKind,
	ProviderCredentialSaveInput,
	PluginProviderKind,
	StoredProvider,
} from '../../shared/provider_types';
import type { ProviderModel } from '../../shared/model_types';
import { ProviderStoreChannels } from '../../shared/ipc_channels_definitions';
import {
	getChannelProvider,
	listChannelProviders,
	loadChannels,
	setChannelProvider,
} from '../channels';
import type { EventBus } from '../event_bus';
import type { AppRegistry } from '../apps/app_registry';
import { loadProviders, loadVectorDatabases } from '../models';
import { loadStorages } from '../models';
import { getEnabledPluginProviders, setPluginProviderEnabled } from '../providers/providers_store';
import { deleteProvider, getProvider, listProviders, setProvider } from '../settings_store';
import type { WindowContextManager } from '../window_context';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

export interface ProviderStoreIpcDeps {
	windows: WindowContextManager;
	apps: AppRegistry;
}

type SavedCredentialKind = Exclude<ProviderCredentialKind, 'search_engines'>;

export class ProviderStoreIpc implements IpcModule<ProviderStoreIpcDeps> {
	readonly name = 'provider-store';

	register({ windows, apps }: ProviderStoreIpcDeps, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		registerQueryWithEvent(ProviderStoreChannels.get, (event, id, kind) => {
			trusted.assert(event);
			const normalizedId = this.id(id);
			const normalizedKind = this.kind(kind);
			return getProvider(normalizedId, normalizedKind);
		});
		registerQueryWithEvent(ProviderStoreChannels.list, (event, kind) => {
			trusted.assert(event);
			if (kind) {
				const normalizedKind = this.kind(kind);
				return listProviders(normalizedKind);
			}
			return listProviders();
		});
		registerQueryWithEvent(ProviderStoreChannels.listEnabledPlugins, (event) => {
			trusted.assert(event);
			return getEnabledPluginProviders();
		});
		registerCommandWithEvent(ProviderStoreChannels.setPluginEnabled, (event, kind, id, enabled) => {
			trusted.assert(event);
			if (kind !== 'database' && kind !== 'storage')
				throw new Error('Invalid plugin provider kind.');
			if (typeof id !== 'string' || typeof enabled !== 'boolean')
				throw new Error('Invalid plugin provider state.');
			const catalog = kind === 'database' ? loadVectorDatabases() : loadStorages();
			if (!catalog.some((entry) => `${entry.provider.id}/${entry.id}` === id)) {
				throw new Error('Unknown plugin provider.');
			}
			return setPluginProviderEnabled(kind as PluginProviderKind, id, enabled);
		});
		registerCommandWithEvent(ProviderStoreChannels.set, (event, value) => {
			trusted.assert(event);
			const input = this.credential(value);
			const provider = this.catalogProvider(input.kind, input.id, input.apiKey, input.baseUrl);
			return setProvider(provider, input.kind);
		});
		registerCommandWithEvent(ProviderStoreChannels.remove, (event, id, kind) => {
			trusted.assert(event);
			deleteProvider(this.id(id), this.kind(kind));
		});
		registerQueryWithEvent(ProviderStoreChannels.listCustomModels, async (event, value) => {
			trusted.assert(event);
			return this.listCustomModels(value);
		});
		registerQueryWithEvent(ProviderStoreChannels.listModels, async (event, providerId) => {
			trusted.assert(event);
			return this.listModels(providerId);
		});
		registerQueryWithEvent(ProviderStoreChannels.listModelProviders, (event) => {
			trusted.assert(event);
			return [...loadProviders()];
		});
		registerQueryWithEvent(ProviderStoreChannels.getChannel, (event, id) => {
			trusted.assert(event);
			const normalizedId = this.channelId(id);
			if (!loadChannels().some((entry) => entry.provider.id === normalizedId)) return undefined;
			const provider = getChannelProvider(normalizedId);
			return provider ? this.channelSummary(provider) : undefined;
		});
		registerQueryWithEvent(ProviderStoreChannels.listChannels, (event) => {
			trusted.assert(event);
			return listChannelProviders()
				.filter((provider) => loadChannels().some((entry) => entry.provider.id === provider.id))
				.map((provider) => this.channelSummary(provider));
		});
		registerCommandWithEvent(ProviderStoreChannels.setChannel, (event, value) => {
			trusted.assert(event);
			return this.saveChannel(this.channelInput(value));
		});
	}

	private credential(value: unknown): ProviderCredentialSaveInput {
		const record = this.record(value);
		const apiKey = typeof record.apiKey === 'string' ? record.apiKey.trim() : '';
		if (!apiKey || apiKey.length > 16_384) throw new Error('The provider API key is invalid.');
		const kind = this.kind(record.kind);
		const id = this.id(record.id);
		if (id !== 'custom') return { kind, id, apiKey };
		if (kind !== 'models') throw new Error('Custom providers support models only.');
		const baseUrl = this.baseUrl(record.baseUrl);
		return { kind, id, apiKey, baseUrl };
	}

	private catalogProvider(
		kind: SavedCredentialKind,
		id: string,
		apiKey: string,
		baseUrl?: string
	): StoredProvider {
		if (id === 'custom') {
			if (!baseUrl) throw new Error('Custom provider configuration is invalid.');
			return { id, name: 'Custom model provider', apiKey, baseUrl };
		}
		if (kind === 'models') {
			const provider = loadProviders().find((entry) => entry.id === id);
			if (!provider) throw new Error('Unknown provider.');
			return { id, name: provider.name, apiKey, baseUrl: provider.baseUrl };
		}
		const services = loadVectorDatabases().filter((entry) => entry.provider.id === id);
		const service = services[0];
		if (!service) throw new Error('Unknown database provider.');
		if (
			!services.some((entry) =>
				getEnabledPluginProviders().database.includes(`${entry.provider.id}/${entry.id}`)
			)
		) {
			throw new Error('Enable this database in Plugins before configuring it.');
		}
		return {
			id,
			name: service.provider.name,
			apiKey,
			baseUrl: service.url ?? service.provider.baseUrl,
		};
	}

	private baseUrl(value: unknown): string {
		const baseUrl = typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
		if (!baseUrl || baseUrl.length > 2_048) throw new Error('The provider base URL is invalid.');
		try {
			const url = new URL(baseUrl);
			if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
			return baseUrl;
		} catch {
			throw new Error('The provider base URL is invalid.');
		}
	}

	private async listCustomModels(value: unknown): Promise<string[]> {
		const record = this.record(value);
		const baseUrl = this.baseUrl(record.baseUrl);
		const url = new URL('models', `${baseUrl}/`);
		const apiKey = typeof record.apiKey === 'string' ? record.apiKey.trim() : '';
		const signal = AbortSignal.timeout(10_000);
		let response: Response;
		try {
			response = await fetch(url.toString(), {
				signal,
				headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
			});
		} catch {
			return [];
		}
		if (!response.ok) throw new Error('Could not load models from the custom provider.');
		const body = (await response.json()) as { data?: unknown };
		if (!Array.isArray(body.data))
			throw new Error('The custom provider returned an invalid model list.');
		return [
			...new Set(
				body.data
					.map((entry) =>
						entry && typeof entry === 'object' ? (entry as { id?: unknown }).id : ''
					)
					.filter(
						(id): id is string => typeof id === 'string' && id.trim().length > 0 && id.length <= 256
					)
					.map((id) => id.trim())
			),
		].sort((left, right) => left.localeCompare(right));
	}

	private async listModels(providerId: unknown): Promise<ProviderModel[]> {
		const id = this.id(providerId);
		const provider = loadProviders().find((entry) => entry.id === id);
		if (!provider?.modelsUrl) throw new Error('This provider has no live model list.');
		const { modelsUrl, modelUrl } = provider;
		const response = await fetch(modelsUrl, { signal: AbortSignal.timeout(10_000) });
		if (!response.ok) throw new Error('Could not load models from the provider.');
		const body = (await response.json()) as { data?: unknown };
		if (!Array.isArray(body.data)) throw new Error('The provider returned an invalid model list.');
		return body.data
			.flatMap((entry): ProviderModel[] => {
				const model = (entry ?? {}) as {
					id?: unknown;
					name?: unknown;
					context_length?: unknown;
					context_window?: unknown;
					architecture?: { output_modalities?: unknown };
					pricing?: { parameters?: Record<string, unknown> };
				};
				const outputs = model.architecture?.output_modalities;
				if (typeof model.id !== 'string' || !model.id.trim() || model.id.length > 256) return [];
				if (Array.isArray(outputs) && !outputs.includes('text')) return [];
				if (model.pricing?.parameters?.output_cost_per_image_token !== undefined) return [];
				const context = model.context_length ?? model.context_window;
				const contextWindow = typeof context === 'number' && context > 0 ? context : undefined;
				return [
					{
						id: model.id,
						name: typeof model.name === 'string' && model.name.trim() ? model.name : model.id,
						metadata: {
							documentationUrl: modelUrl?.replace('{id}', model.id) ?? modelsUrl,
							promptAttachments: [],
							inputs: {},
							...(contextWindow ? { contextWindow } : {}),
						},
					},
				];
			})
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	private channelInput(value: unknown): ChannelCredentialSaveInput {
		const record = this.record(value);
		const dmPolicy = CHANNEL_DM_POLICIES.includes(record.dmPolicy as never)
			? (record.dmPolicy as ChannelCredentialSaveInput['dmPolicy'])
			: undefined;
		return {
			id: this.channelId(record.id),
			apiKey:
				typeof record.apiKey === 'string' && record.apiKey.length <= 16_384
					? record.apiKey.trim()
					: '',
			...(record.credentials &&
			typeof record.credentials === 'object' &&
			!Array.isArray(record.credentials)
				? {
						credentials: Object.fromEntries(
							Object.entries(record.credentials)
								.filter(
									([key, value]) =>
										/^[a-zA-Z0-9._-]{1,128}$/.test(key) &&
										typeof value === 'string' &&
										value.length <= 16_384
								)
								.map(([key, value]) => [key, (value as string).trim()])
						),
					}
				: {}),
			...(this.list(record.allowFrom) ? { allowFrom: this.list(record.allowFrom) } : {}),
			...(this.list(record.groupAllowFrom)
				? { groupAllowFrom: this.list(record.groupAllowFrom) }
				: {}),
			...(dmPolicy ? { dmPolicy } : {}),
			...this.optionalIdentifiers(record),
		};
	}

	private saveChannel(input: ChannelCredentialSaveInput): ChannelCredentialSummary {
		const service = loadChannels().find((entry) => entry.provider.id === input.id);
		if (!service) throw new Error('Unknown channel provider.');
		const existing = getChannelProvider(input.id);
		const credentials = {
			...existing?.credentials,
			...Object.fromEntries(Object.entries(input.credentials ?? {}).filter(([, value]) => value)),
		};
		const apiKey = input.apiKey || credentials.apiKey || existing?.apiKey || '';
		if (apiKey) credentials.apiKey = apiKey;
		for (const field of service.credentials ?? []) {
			if (field.required && !credentials[field.key]) throw new Error(`${field.label} is required.`);
		}
		const saved = setChannelProvider({
			...existing,
			...input,
			id: input.id,
			name: service.provider.name,
			baseUrl: service.url ?? service.provider.baseUrl,
			apiKey,
			credentials,
		});
		return this.channelSummary(saved);
	}

	private channelSummary(provider: StoredChannelProvider): ChannelCredentialSummary {
		const { apiKey, credentials, ...summary } = provider;
		const service = loadChannels().find((entry) => entry.provider.id === provider.id);
		const values = { ...credentials, ...(apiKey ? { apiKey } : {}) };
		return {
			...summary,
			configured:
				Boolean(service) &&
				(service?.credentials ?? []).every(
					(field) => !field.required || Boolean(values[field.key]?.trim())
				),
		};
	}

	private kind(value: unknown): SavedCredentialKind {
		if (value === 'models' || value === 'databases') return value;
		throw new Error('The provider kind is invalid.');
	}

	private id(value: unknown): string {
		const id = typeof value === 'string' ? value.trim().toLowerCase() : '';
		if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(id)) {
			throw new Error('The provider identifier is invalid.');
		}
		return id;
	}

	private channelId(value: unknown): string {
		const id = typeof value === 'string' ? value.trim().toLowerCase() : '';
		if (!/^[a-z0-9][a-z0-9._-]{0,127}\/[a-z0-9][a-z0-9._-]{0,127}$/.test(id)) {
			throw new Error('The channel identifier is invalid.');
		}
		return id;
	}

	private record(value: unknown): Record<string, unknown> {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			throw new Error('The provider credential input is invalid.');
		}
		return value as Record<string, unknown>;
	}

	private list(value: unknown): string[] | undefined {
		if (value === undefined) return undefined;
		if (!Array.isArray(value) || value.length > 256) {
			throw new Error('The channel access list is invalid.');
		}
		const result = value.map((entry) => (typeof entry === 'string' ? entry.trim() : ''));
		if (result.some((entry) => !entry || entry.length > 256)) {
			throw new Error('The channel access list is invalid.');
		}
		return [...new Set(result)];
	}

	private optionalIdentifiers(
		record: Record<string, unknown>
	): Pick<
		ChannelCredentialSaveInput,
		'sttProviderId' | 'sttModelId' | 'ttsProviderId' | 'ttsModelId'
	> {
		const result: Record<string, string> = {};
		for (const key of ['sttProviderId', 'sttModelId', 'ttsProviderId', 'ttsModelId']) {
			const value = record[key];
			if (value === undefined) continue;
			if (typeof value !== 'string' || value.trim().length > 200) {
				throw new Error('The channel model identifier is invalid.');
			}
			result[key] = value.trim();
		}
		return result;
	}
}
