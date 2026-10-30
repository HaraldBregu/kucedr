/** Services whose saved keys the backend gateway can use. Mirrors supabase/functions/_shared/services.ts. */
export const CLOUD_CREDENTIAL_SERVICES = ['openai', 'anthropic', 'deepseek', 'mistral', 'xai'] as const;

export type CloudCredentialService = (typeof CLOUD_CREDENTIAL_SERVICES)[number];

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
