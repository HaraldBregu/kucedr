export interface VectorDatabaseService {
	readonly providerId: string;
	readonly databaseId: string;
	readonly providerName: string;
	readonly databaseName: string;
}

export interface VectorDatabaseRecord {
	readonly id: string;
	readonly path: string;
	readonly text: string;
	readonly vector: readonly number[];
}

export interface VectorDatabaseUpload {
	readonly apiKey: string;
	readonly indexName: string;
	readonly generation: string;
	readonly dimensions: number;
	readonly records: readonly VectorDatabaseRecord[];
	readonly signal?: AbortSignal;
	assertCurrent(): void;
}

export interface VectorDatabaseAdapter {
	readonly service: VectorDatabaseService;
	consentRecipient(apiKey: string, indexName: string): readonly string[];
	upload(input: VectorDatabaseUpload): Promise<void>;
	discard(apiKey: string, indexName: string, generation: string, signal?: AbortSignal): Promise<void>;
	purge(apiKey: string, indexName: string, generation?: string): Promise<number>;
}
