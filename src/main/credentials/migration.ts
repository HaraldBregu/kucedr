import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import Store from 'electron-store';
import {
	CLOUD_CREDENTIAL_SERVICES,
	type CloudCredentialService,
	type CredentialMigrationResult,
	type LocalCredential,
} from '../../shared/credential_types';
import type { StoredProvider } from '../../shared/provider_types';
import { userDataLocation } from '../shared/user_data_location';
import type { CredentialService } from './service';

interface MigrationRecord {
	requestId: string;
	fingerprint: string;
	credentialId?: string;
}

interface MigrationState {
	records: Record<string, MigrationRecord>;
}

export interface LocalProviderPort {
	list(): StoredProvider[];
	remove(id: string): void;
}

/** User-initiated upload of local model keys to the signed-in account. Never runs automatically. */
export class CredentialMigration {
	constructor(
		private readonly credentials: CredentialService,
		private readonly userId: () => string | undefined,
		private readonly local: LocalProviderPort,
		private readonly store: Store<MigrationState> = new Store<MigrationState>({
			name: 'migrations',
			cwd: path.resolve(userDataLocation(), 'credentials'),
			accessPropertiesByDotNotation: false,
			defaults: { records: {} },
		})
	) {}

	listLocal(): LocalCredential[] {
		const userId = this.userId();
		return this.local
			.list()
			.filter((provider) => isCloudService(provider.id) && provider.apiKey.trim())
			.map((provider) => {
				const record = userId ? this.record(userId, provider) : undefined;
				return {
					localId: provider.id,
					service: provider.id as CloudCredentialService,
					name: provider.name,
					lastFour: provider.apiKey.length >= 16 ? provider.apiKey.slice(-4) : null,
					...(record?.credentialId ? { uploadedCredentialId: record.credentialId } : {}),
				};
			});
	}

	async migrate(localIds: string[]): Promise<CredentialMigrationResult[]> {
		const userId = this.requireUserId();
		const results: CredentialMigrationResult[] = [];
		for (const localId of new Set(localIds)) {
			const provider = this.local.list().find((entry) => entry.id === localId);
			if (!provider || !isCloudService(provider.id) || !provider.apiKey.trim()) {
				results.push({ localId, error: 'This local API key cannot be uploaded.' });
				continue;
			}
			const fingerprint = fingerprintOf(provider.apiKey);
			const key = `${userId}:${localId}`;
			const existing = this.store.get('records')[key];
			const record =
				existing?.fingerprint === fingerprint ? existing : { requestId: randomUUID(), fingerprint };
			this.save(key, record);
			try {
				const credential = await this.credentials.create(
					{ service: provider.id, label: provider.name, secret: provider.apiKey.trim() },
					record.requestId
				);
				if (this.userId() !== userId) throw new Error('The signed-in account changed.');
				this.save(key, { ...record, credentialId: credential.id });
				results.push({ localId, credentialId: credential.id });
			} catch (error) {
				results.push({ localId, error: error instanceof Error ? error.message : 'Upload failed.' });
			}
		}
		return results;
	}

	/** Deletes the local copy only after confirming the uploaded credential still exists for this account. */
	async removeLocal(localId: string): Promise<string> {
		const userId = this.requireUserId();
		const provider = this.local.list().find((entry) => entry.id === localId);
		const record = provider && this.record(userId, provider);
		if (!record?.credentialId) throw new Error('Upload this API key before removing the local copy.');
		const uploaded = await this.credentials.list();
		if (this.userId() !== userId || !uploaded.some((entry) => entry.id === record.credentialId)) {
			throw new Error('The uploaded API key could not be verified. The local copy was kept.');
		}
		this.local.remove(localId);
		const { [`${userId}:${localId}`]: _removed, ...records } = this.store.get('records');
		this.store.set('records', records);
		return record.credentialId;
	}

	private record(userId: string, provider: StoredProvider): MigrationRecord | undefined {
		const record = this.store.get('records')[`${userId}:${provider.id}`];
		return record?.fingerprint === fingerprintOf(provider.apiKey) ? record : undefined;
	}

	private save(key: string, record: MigrationRecord): void {
		this.store.set('records', { ...this.store.get('records'), [key]: record });
	}

	private requireUserId(): string {
		const userId = this.userId();
		if (!userId) throw new Error('Sign in to upload local API keys.');
		return userId;
	}
}

function isCloudService(id: string): id is CloudCredentialService {
	return (CLOUD_CREDENTIAL_SERVICES as readonly string[]).includes(id);
}

function fingerprintOf(apiKey: string): string {
	return createHash('sha256').update(apiKey.trim()).digest('hex');
}
