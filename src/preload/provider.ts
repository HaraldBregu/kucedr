import { typedInvokeUnwrap } from '../shared/ipc_types';
import { ProviderStoreChannels } from '../shared/ipc_channels_definitions';
import type { ProviderApi } from './index.d';
import type {
	ProviderCredentialKind,
	ProviderCredentialSaveInput,
	ProviderCredentialSummary,
	PublicProvider,
} from '../shared/provider_types';
import type { ChannelCredentialSaveInput } from '../shared/channels_types';

type SavedCredentialKind = Exclude<ProviderCredentialKind, 'search_engines'>;

/** Unique providers from catalog entries, overlaid with stored settings data. */
async function uniqueProvidersWithStored(
	entries: readonly { provider: PublicProvider }[],
	kind: SavedCredentialKind
): Promise<PublicProvider[]> {
	const stored = await provider.list(kind);
	const storedById = new Map(stored.map((entry) => [entry.id, entry]));
	const providersMap = new Map<string, PublicProvider>();
	entries.forEach((entry) => {
		const saved = storedById.get(entry.provider.id);
		providersMap.set(entry.provider.id, {
			...entry.provider,
			baseUrl: saved?.baseUrl || entry.provider.baseUrl,
		});
	});
	return Array.from(providersMap.values());
}

export const provider: ProviderApi = {
	get: (id: string, kind: SavedCredentialKind): Promise<ProviderCredentialSummary | undefined> => {
		return typedInvokeUnwrap(ProviderStoreChannels.get, id, kind);
	},
	set: (input: ProviderCredentialSaveInput) => {
		return typedInvokeUnwrap(ProviderStoreChannels.set, input);
	},
	list: (kind?: SavedCredentialKind) => {
		return kind
			? typedInvokeUnwrap(ProviderStoreChannels.list, kind)
			: typedInvokeUnwrap(ProviderStoreChannels.list);
	},
	getChannel: (id: string) => typedInvokeUnwrap(ProviderStoreChannels.getChannel, id),
	setChannel: (input: ChannelCredentialSaveInput) =>
		typedInvokeUnwrap(ProviderStoreChannels.setChannel, input),
	listChannels: () => typedInvokeUnwrap(ProviderStoreChannels.listChannels),
	vaultStatus: () => typedInvokeUnwrap(ProviderStoreChannels.vaultStatus),
	setupVault: (passphrase: string) =>
		typedInvokeUnwrap(ProviderStoreChannels.setupVault, passphrase),
	unlockVault: (passphrase: string) =>
		typedInvokeUnwrap(ProviderStoreChannels.unlockVault, passphrase),
	changeVaultPassphrase: (passphrase: string) =>
		typedInvokeUnwrap(ProviderStoreChannels.changeVaultPassphrase, passphrase),
	syncVault: () => typedInvokeUnwrap(ProviderStoreChannels.syncVault),
	getModelProviders: async (): Promise<PublicProvider[]> => {
		return uniqueProvidersWithStored(await window.app.models(), 'models');
	},
	getDatabaseProviders: async (): Promise<PublicProvider[]> => {
		return uniqueProvidersWithStored(await window.app.databases(), 'databases');
	},
};
