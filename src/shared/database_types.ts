export interface DatabaseConfiguration {
	providerId: string | undefined;
	databaseId: string | undefined;
}

export interface VectorDatabaseService {
	readonly providerId: string;
	readonly databaseId: string;
	readonly providerName: string;
	readonly databaseName: string;
}
