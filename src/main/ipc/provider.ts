import type { ChannelCredentialSaveInput, ChannelCredentialSummary, StoredChannelProvider } from '../../shared/channels_types';
import { isChannelId } from '../../shared/channels_definitions';
import { CHANNEL_DM_POLICIES } from '../../shared/channels_types';
import type {
	ProviderCredentialKind,
	ProviderCredentialSaveInput,
	StoredProvider,
} from '../../shared/provider_types';
import { ProviderStoreChannels } from '../../shared/ipc_channels_definitions';
import {
	getChannelProvider,
	listChannelProviders,
	loadChannels,
	setChannelProvider,
} from '../channels';
import type { EventBus } from '../event_bus';
import type { AppRegistry } from '../apps/app_registry';
import { loadDatabases, loadProviders } from '../models';
import { getProvider, listProviders, setProvider } from '../settings_store';
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
		registerCommandWithEvent(ProviderStoreChannels.set, (event, value) => {
			trusted.assert(event);
			const input = this.credential(value);
			const provider = this.catalogProvider(input.kind, input.id, input.apiKey);
			return setProvider(provider, input.kind);
		});
		registerQueryWithEvent(ProviderStoreChannels.getChannel, (event, id) => {
			trusted.assert(event);
			const normalizedId = this.id(id);
			if (!isChannelId(normalizedId)) return undefined;
			const provider = getChannelProvider(normalizedId);
			return provider ? this.channelSummary(provider) : undefined;
		});
		registerQueryWithEvent(ProviderStoreChannels.listChannels, (event) => {
			trusted.assert(event);
			return listChannelProviders()
				.filter((provider) => isChannelId(provider.id))
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
		return { kind: this.kind(record.kind), id: this.id(record.id), apiKey };
	}

	private catalogProvider(kind: SavedCredentialKind, id: string, apiKey: string): StoredProvider {
		if (kind === 'models') {
			const provider = loadProviders().find((entry) => entry.id === id);
			if (!provider) throw new Error('Unknown provider.');
			return { id, name: provider.name, apiKey, baseUrl: provider.baseUrl };
		}
		const service = loadDatabases().find((entry) => entry.provider.id === id);
		if (!service) throw new Error('Unknown database provider.');
		return {
			id,
			name: service.provider.name,
			apiKey,
			baseUrl: service.url ?? service.provider.baseUrl,
		};
	}

	private channelInput(value: unknown): ChannelCredentialSaveInput {
		const record = this.record(value);
		const dmPolicy = CHANNEL_DM_POLICIES.includes(record.dmPolicy as never)
			? (record.dmPolicy as ChannelCredentialSaveInput['dmPolicy'])
			: undefined;
		return {
			id: this.id(record.id),
			apiKey:
				typeof record.apiKey === 'string' && record.apiKey.length <= 16_384
					? record.apiKey.trim()
					: '',
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
		const apiKey = input.apiKey || existing?.apiKey || '';
		if (!apiKey) throw new Error('The bot token is required.');
		const saved = setChannelProvider({
			...existing,
			...input,
			id: input.id,
			name: service.provider.name,
			baseUrl: service.url ?? service.provider.baseUrl,
			apiKey,
		});
		return this.channelSummary(saved);
	}

	private channelSummary(provider: StoredChannelProvider): ChannelCredentialSummary {
		const { apiKey, ...summary } = provider;
		return { ...summary, configured: Boolean(apiKey.trim()) };
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
