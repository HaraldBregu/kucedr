import { randomUUID } from 'node:crypto';
import { safeStorage } from 'electron';
import type Store from 'electron-store';
import type { StorageProvider } from '../../../shared/storage_types';
import { isSafeStorageAvailable } from '../../shared/safe_storage';
import { restrictSettingsFile } from '../../shared/restrict_settings_file';
import { normalizeStorageProvider } from './normalize';
import { storageProviderIdentifier } from './identifier';
import { storageProviderSummary } from './summary';
import type {
	PersistedStorageProvider,
	StorageProvidersState,
	StoredStorageProvider,
} from './types';

export class StorageProviderStore {
	constructor(
		private readonly store: Pick<Store<StorageProvidersState>, 'get' | 'set' | 'path'>,
		private readonly encryption: Pick<
			typeof safeStorage,
			'isEncryptionAvailable' | 'getSelectedStorageBackend' | 'encryptString' | 'decryptString'
		> = safeStorage,
		private readonly platform: NodeJS.Platform = process.platform
	) {}

	list(): StorageProvider[] {
		return this.read().map(storageProviderSummary);
	}

	resolve(id: unknown): StoredStorageProvider {
		if (!id) throw new Error('Select a storage provider for cloud backup.');
		const identifier = storageProviderIdentifier(id);
		const provider = this.read().find((entry) => entry.id === identifier);
		if (!provider) throw new Error('The selected storage provider was not found.');
		return provider;
	}

	save(value: unknown): StorageProvider {
		const input = normalizeStorageProvider(value);
		this.assertAvailable();
		const providers = this.read();
		const index = input.id ? providers.findIndex((provider) => provider.id === input.id) : -1;
		if (input.id && index === -1) throw new Error('Storage provider was not found.');
		const secretAccessKey = input.secretAccessKey || providers[index]?.secretAccessKey;
		if (!secretAccessKey) throw new Error('Storage secret access key is required.');
		const provider: StoredStorageProvider = {
			...input,
			id: input.id ?? randomUUID(),
			secretAccessKey,
		};
		if (index === -1) providers.push(provider);
		else providers[index] = provider;
		this.write(providers);
		return storageProviderSummary(provider);
	}

	remove(id: unknown): boolean {
		const identifier = storageProviderIdentifier(id);
		const providers = this.read();
		const remaining = providers.filter((provider) => provider.id !== identifier);
		if (remaining.length === providers.length) return false;
		this.write(remaining);
		return true;
	}

	private read(): StoredStorageProvider[] {
		const storage = this.store.get('storage');
		if (!storage.length) return [];
		this.assertAvailable();
		try {
			return storage.map((value) => {
				const { encryptedSecretAccessKey, ...metadata } = value;
				const provider = normalizeStorageProvider({
					...metadata,
					secretAccessKey: this.encryption.decryptString(
						Buffer.from(encryptedSecretAccessKey, 'base64')
					),
				});
				if (!provider.id || !provider.secretAccessKey)
					throw new Error('Invalid storage provider data.');
				return { ...provider, id: provider.id, secretAccessKey: provider.secretAccessKey };
			});
		} catch {
			throw new Error('Saved storage providers could not be opened.');
		}
	}

	private write(providers: StoredStorageProvider[]): void {
		this.assertAvailable();
		const storage: PersistedStorageProvider[] = providers.map(
			({ secretAccessKey, ...provider }) => ({
				...provider,
				encryptedSecretAccessKey: this.encryption.encryptString(secretAccessKey).toString('base64'),
			})
		);
		this.store.set('storage', storage);
		restrictSettingsFile(this.store.path);
	}

	private assertAvailable(): void {
		if (!isSafeStorageAvailable(this.encryption, this.platform)) {
			throw new Error(
				'Secure operating-system storage is unavailable. Storage credentials cannot be saved or opened.'
			);
		}
	}
}
