import path from 'node:path';
import Store from 'electron-store';
import type { ChannelModelKind, ChannelModelSelection, StoredChannelProvider } from '../../shared';
import { userDataLocation } from '../shared/user_data_location';
import { getModelId, getProviderId } from '../models/selection';
import { safeStorage } from 'electron';
import { isSafeStorageAvailable } from '../shared/safe_storage';
import { restrictSettingsFile } from '../shared/restrict_settings_file';

type PersistedChannelProvider = Omit<StoredChannelProvider, 'apiKey'> & { readonly apiKey?: string };

type ChannelModelKeys = {
	providerId: keyof ChannelsStoreState;
	modelId: keyof ChannelsStoreState;
};

const CHANNEL_MODEL_KEYS: Record<ChannelModelKind, ChannelModelKeys> = {
	llm: {
		providerId: 'llmProviderId',
		modelId: 'llmModelId',
	},
	stt: {
		providerId: 'sttProviderId',
		modelId: 'sttModelId',
	},
	tts: {
		providerId: 'ttsProviderId',
		modelId: 'ttsModelId',
	},
} as const;

export interface ChannelsStoreState {
	readonly providers: PersistedChannelProvider[];
	readonly encryptedApiKeys: Record<string, string>;
	readonly llmProviderId?: string;
	readonly llmModelId?: string;
	readonly sttProviderId?: string;
	readonly sttModelId?: string;
	readonly ttsProviderId?: string;
	readonly ttsModelId?: string;
}

const CHANNEL_MODELS_FALLBACKS: Record<ChannelModelKind, () => ChannelModelSelection> = {
	llm: () => ({ providerId: getProviderId('text'), modelId: getModelId('text') }),
	stt: () => ({ providerId: getProviderId('transcribe'), modelId: getModelId('transcribe') }),
	tts: () => ({ providerId: getProviderId('voice'), modelId: getModelId('voice') }),
};

const store = new Store<ChannelsStoreState>({
	name: 'channels',
	cwd: path.resolve(userDataLocation(), 'settings'),
	accessPropertiesByDotNotation: false,
	defaults: {
		providers: [],
		encryptedApiKeys: {},
	},
});

export const channelsStorePath = store.path;
restrictSettingsFile(channelsStorePath);
const volatileApiKeys = new Map<string, string>();

function trimValue(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

export function listChannelProviders(): StoredChannelProvider[] {
	const encryptedApiKeys = { ...(store.get('encryptedApiKeys') ?? {}) };
	let migrated = false;
	const providers = store.get('providers').map((provider) => {
		const { apiKey: plaintextApiKey, ...metadata } = provider;
		let apiKey = volatileApiKeys.get(provider.id) ?? '';
		if (plaintextApiKey) {
			apiKey = plaintextApiKey;
			migrated = true;
			if (isSafeStorageAvailable()) {
				encryptedApiKeys[provider.id] = safeStorage
					.encryptString(JSON.stringify({ id: provider.id, apiKey }))
					.toString('base64');
			} else {
				volatileApiKeys.set(provider.id, apiKey);
			}
		} else if (encryptedApiKeys[provider.id] && isSafeStorageAvailable()) {
			try {
				const opened = JSON.parse(
					safeStorage.decryptString(Buffer.from(encryptedApiKeys[provider.id], 'base64'))
				) as { id?: unknown; apiKey?: unknown };
				if (opened.id === provider.id && typeof opened.apiKey === 'string') apiKey = opened.apiKey;
			} catch {
				apiKey = '';
			}
		}
		return { ...metadata, apiKey };
	});
	if (migrated) {
		store.set(
			'providers',
			providers.map(({ apiKey: _apiKey, ...provider }) => provider)
		);
		store.set('encryptedApiKeys', encryptedApiKeys);
		restrictSettingsFile(channelsStorePath);
	}
	return providers;
}

export function getChannelProvider(id: string): StoredChannelProvider | undefined {
	return listChannelProviders().find((provider) => provider.id === id);
}

export function setChannelProvider(provider: StoredChannelProvider): StoredChannelProvider {
	const providers = listChannelProviders();
	const index = providers.findIndex((entry) => entry.id === provider.id);
	if (index === -1) providers.push(provider);
	else providers[index] = provider;
	store.set(
		'providers',
		providers.map(({ apiKey: _apiKey, ...entry }) => entry)
	);
	const encryptedApiKeys = { ...(store.get('encryptedApiKeys') ?? {}) };
	if (provider.apiKey) {
		if (isSafeStorageAvailable()) {
			encryptedApiKeys[provider.id] = safeStorage
				.encryptString(JSON.stringify({ id: provider.id, apiKey: provider.apiKey }))
				.toString('base64');
			volatileApiKeys.delete(provider.id);
		} else {
			delete encryptedApiKeys[provider.id];
			volatileApiKeys.set(provider.id, provider.apiKey);
		}
	} else {
		delete encryptedApiKeys[provider.id];
		volatileApiKeys.delete(provider.id);
	}
	store.set('encryptedApiKeys', encryptedApiKeys);
	restrictSettingsFile(channelsStorePath);
	return provider;
}

export function getChannelModelSelection(kind: ChannelModelKind): ChannelModelSelection {
	const keys = CHANNEL_MODEL_KEYS[kind];
	const fallback = CHANNEL_MODELS_FALLBACKS[kind]();
	const providerId = trimValue(store.get(keys.providerId)) ?? trimValue(fallback.providerId);
	const modelId = trimValue(store.get(keys.modelId)) ?? trimValue(fallback.modelId);

	return {
		providerId,
		modelId,
	};
}

export function setChannelModelSelection(
	kind: ChannelModelKind,
	selection: ChannelModelSelection
): void {
	const keys = CHANNEL_MODEL_KEYS[kind];
	store.set(keys.providerId, trimValue(selection.providerId) ?? '');
	store.set(keys.modelId, trimValue(selection.modelId) ?? '');
}

export function getChannelModelSelections(): Record<ChannelModelKind, ChannelModelSelection> {
	const selections: Record<ChannelModelKind, ChannelModelSelection> = {
		llm: getChannelModelSelection('llm'),
		stt: getChannelModelSelection('stt'),
		tts: getChannelModelSelection('tts'),
	};
	return selections;
}

export function setChannelModelSelections(
	selections: Partial<Record<ChannelModelKind, ChannelModelSelection>>
): void {
	for (const kind of ['llm', 'stt', 'tts'] as const) {
		const selection = selections[kind];
		if (!selection) continue;
		setChannelModelSelection(kind, selection);
	}
}
