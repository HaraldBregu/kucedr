import type { ChannelModelKind, ChannelModelSelection, StoredChannelProvider } from '../../shared';
import { safeStorage } from 'electron';
import { isSafeStorageAvailable } from '../shared/safe_storage';
import { restrictSettingsFile } from '../shared/restrict_settings_file';
import {
	agentProfileStorePath,
	getAgentProfileDocument,
	getAgentProfileModel,
	setAgentProfileDocument,
	setAgentProfileModel,
} from '../agent/agent_profiles';

type PersistedChannelProvider = Omit<StoredChannelProvider, 'apiKey'> & {
	readonly apiKey?: string;
};

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

const CHANNEL_PROFILE_MODELS: Record<
	ChannelModelKind,
	'textToText' | 'speechToText' | 'textToSpeech'
> = {
	llm: 'textToText',
	stt: 'speechToText',
	tts: 'textToSpeech',
};

export const channelsStorePath = agentProfileStorePath('channels');
restrictSettingsFile(channelsStorePath);
const volatileApiKeys = new Map<string, string>();

function readChannelsState(): ChannelsStoreState {
	const stored = getAgentProfileDocument('channels') as Partial<ChannelsStoreState>;
	return {
		...stored,
		providers: stored.providers ?? [],
		encryptedApiKeys: stored.encryptedApiKeys ?? {},
	};
}

function writeChannelsState(next: ChannelsStoreState): void {
	setAgentProfileDocument('channels', { ...getAgentProfileDocument('channels'), ...next });
}

function trimValue(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

export function listChannelProviders(): StoredChannelProvider[] {
	const state = readChannelsState();
	const encryptedApiKeys = { ...state.encryptedApiKeys };
	let migrated = false;
	const providers = state.providers.map((provider) => {
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
		writeChannelsState({
			...state,
			providers: providers.map(({ apiKey: _apiKey, ...provider }) => provider),
			encryptedApiKeys,
		});
		restrictSettingsFile(channelsStorePath);
	}
	return providers;
}

export function getChannelProvider(id: string): StoredChannelProvider | undefined {
	return listChannelProviders().find((provider) => provider.id === id);
}

export function setChannelProvider(provider: StoredChannelProvider): StoredChannelProvider {
	const providers = listChannelProviders();
	const state = readChannelsState();
	const index = providers.findIndex((entry) => entry.id === provider.id);
	if (index === -1) providers.push(provider);
	else providers[index] = provider;
	const encryptedApiKeys = { ...state.encryptedApiKeys };
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
	writeChannelsState({
		...state,
		providers: providers.map(({ apiKey: _apiKey, ...entry }) => entry),
		encryptedApiKeys,
	});
	restrictSettingsFile(channelsStorePath);
	return provider;
}

export function getChannelModelSelection(kind: ChannelModelKind): ChannelModelSelection {
	const modelKey = CHANNEL_PROFILE_MODELS[kind];
	const model = getAgentProfileModel('channels', modelKey);

	return {
		providerId: trimValue(model.providerId),
		modelId: trimValue(model.modelId),
	};
}

export function setChannelModelSelection(
	kind: ChannelModelKind,
	selection: ChannelModelSelection
): void {
	const modelKey = CHANNEL_PROFILE_MODELS[kind];
	setAgentProfileModel('channels', modelKey, {
		...getAgentProfileModel('channels', modelKey),
		providerId: trimValue(selection.providerId) ?? '',
		modelId: trimValue(selection.modelId) ?? '',
	});
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
