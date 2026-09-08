import { randomUUID } from 'node:crypto';
import { safeStorage } from 'electron';
import type Store from 'electron-store';
import type { StorageProvider } from '../../../shared/storage_types';
import { isSafeStorageAvailable } from '../../shared/safe_storage';
import { restrictSettingsFile } from '../../shared/restrict_settings_file';
import { normalizeStorageProvider } from './normalize';
import { storageProviderIdentifier } from './identifier';
import { storageProviderSummary } from './summary';
import type { StorageProvidersState, StoredStorageProvider } from './types';

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
		const encrypted = this.store.get('encryptedProviders');
		if (!encrypted) return [];
		this.assertAvailable();
		try {
			const values: unknown = JSON.parse(
				this.encryption.decryptString(Buffer.from(encrypted, 'base64'))
			);
			if (!Array.isArray(values)) throw new Error('Invalid storage provider data.');
			return values.map((value) => {
				const provider = normalizeStorageProvider(value);
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
		const encrypted = this.encryption.encryptString(JSON.stringify(providers)).toString('base64');
		this.store.set('encryptedProviders', encrypted);
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
