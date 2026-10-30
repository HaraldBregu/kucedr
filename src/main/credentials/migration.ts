import {
	CLOUD_CREDENTIAL_SERVICES,
	type CloudCredentialService,
	type CredentialMigrationResult,
	type LocalCredential,
} from '../../shared/credential_types';
import type { StoredProvider } from '../../shared/provider_types';
import type { CredentialService } from './service';

export interface LocalProviderPort {
	list(): StoredProvider[];
	remove(id: string): void;
}

/** User-initiated upload of local model keys to the account's keys file. Never runs automatically. */
export class CredentialMigration {
	constructor(
		private readonly credentials: CredentialService,
		private readonly local: LocalProviderPort
	) {}

	listLocal(): LocalCredential[] {
		return this.uploadable().map((provider) => {
			const uploaded = this.credentials.findSecret(provider.id, provider.apiKey.trim());
			return {
				localId: provider.id,
				service: provider.id,
				name: provider.name,
				lastFour: provider.apiKey.length >= 16 ? provider.apiKey.slice(-4) : null,
				...(uploaded ? { uploadedCredentialId: uploaded } : {}),
			};
		});
	}

	async migrate(localIds: string[]): Promise<CredentialMigrationResult[]> {
		await this.credentials.list();
		const results: CredentialMigrationResult[] = [];
		for (const localId of new Set(localIds)) {
			const provider = this.uploadable().find((entry) => entry.id === localId);
			if (!provider) {
				results.push({ localId, error: 'This local API key cannot be uploaded.' });
				continue;
			}
			const secret = provider.apiKey.trim();
			try {
				const credentialId =
					this.credentials.findSecret(provider.id, secret) ??
					(await this.credentials.create({ service: provider.id, label: provider.name, secret })).id;
				results.push({ localId, credentialId });
			} catch (error) {
				results.push({ localId, error: error instanceof Error ? error.message : 'Upload failed.' });
			}
		}
		return results;
	}

	/** Deletes the local copy only after the freshly downloaded keys file is confirmed to hold it. */
	async removeLocal(localId: string): Promise<string> {
		await this.credentials.list();
		const provider = this.uploadable().find((entry) => entry.id === localId);
		const credentialId = provider && this.credentials.findSecret(provider.id, provider.apiKey.trim());
		if (!credentialId) throw new Error('Upload this API key before removing the local copy.');
		this.local.remove(localId);
		return credentialId;
	}

	private uploadable(): (StoredProvider & { id: CloudCredentialService })[] {
		return this.local
			.list()
			.filter(
				(provider): provider is StoredProvider & { id: CloudCredentialService } =>
					(CLOUD_CREDENTIAL_SERVICES as readonly string[]).includes(provider.id) &&
					Boolean(provider.apiKey.trim())
			);
	}
}
