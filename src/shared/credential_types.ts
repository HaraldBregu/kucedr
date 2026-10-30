/** Services whose keys can be saved in the account. Mirrors src/main/credentials/services.ts. */
export const CLOUD_CREDENTIAL_SERVICES = ['openai', 'anthropic', 'deepseek', 'mistral', 'xai'] as const;

export type CloudCredentialService = (typeof CLOUD_CREDENTIAL_SERVICES)[number];

/** signed-out: no account. empty: no keys file yet. locked: passphrase needed on this device. */
export type CredentialVaultStatus = 'signed-out' | 'empty' | 'locked' | 'unlocked';

export interface CloudCredential {
	id: string;
	service: CloudCredentialService;
	label: string;
	lastFour: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CloudCredentialInput {
	service: CloudCredentialService;
	label: string;
	secret: string;
}

export interface LocalCredential {
	localId: string;
	service: CloudCredentialService;
	name: string;
	lastFour: string | null;
	uploadedCredentialId?: string;
}

export interface CredentialMigrationResult {
	localId: string;
	credentialId?: string;
	error?: string;
}

export interface CredentialsApi {
	status(): Promise<CredentialVaultStatus>;
	/** Creates the keys file on first use, otherwise decrypts it. */
	unlock(passphrase: string): Promise<void>;
	lock(): Promise<void>;
	list(): Promise<CloudCredential[]>;
	create(input: CloudCredentialInput): Promise<CloudCredential>;
	replace(id: string, secret: string): Promise<CloudCredential>;
	rename(id: string, label: string): Promise<CloudCredential>;
	test(id: string): Promise<boolean>;
	remove(id: string): Promise<void>;
	/** Active cloud key per plugin id for the signed-in account. */
	active(): Promise<Record<string, string>>;
	activate(service: CloudCredentialService, id: string | null): Promise<void>;
	listLocal(): Promise<LocalCredential[]>;
	migrate(localIds: string[]): Promise<CredentialMigrationResult[]>;
	removeLocal(localId: string): Promise<void>;
}
