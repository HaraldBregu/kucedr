export const DEFAULT_RAG_INDEX_NAME = 'kucedr';
export const LOCAL_RAG_DATABASE_PROVIDER_ID = 'local';
export const LOCAL_RAG_DATABASE_ID = 'sqlite';

export interface RagConfiguration {
	enabled: boolean;
	indexName: string;
	databaseProviderId: string;
	databaseId: string;
	embeddingProviderId: string;
	embeddingModelId: string;
	embeddingConsent: { providerId: string; modelId: string; version?: 1; recipient?: string } | null;
	mirrorConsent?: { version: 1; indexName: string; recipient?: string } | null;
	folders: string[];
	scheduleEnabled: boolean;
	cronExpression: string;
	timezone?: string;
	minimumScore?: number;
}
