export type DataScope =
	| { kind: 'rag'; mode: 'local_index'; indexName: string }
	| { kind: 'rag'; mode: 'local_namespace'; indexName: string; generation: string }
	| { kind: 'rag'; mode: 'remote_namespace'; indexName: string; generation: string }
	| { kind: 'rag'; mode: 'remote_all_namespaces'; indexName: string }
	| { kind: 'memory' }
	| { kind: 'sessions'; sessionIds: string[] };

export interface DataExportResult {
	scope: DataScope | { kind: 'all' };
	filePath: string;
	files: number;
	bytes: number;
}

export interface DataPurgePreview {
	confirmationId: string;
	scope: DataScope;
	description: string;
	files: number;
	bytes: number;
	expiresAt: string;
	remoteDataIncluded: boolean;
}

export interface DataPurgeResult {
	scope: DataScope;
	files: number;
	bytes: number;
	remoteDataDeleted: boolean;
	remoteNamespacesDeleted?: number;
}

export const CHAT_RETENTION_DAYS: readonly number[] = [0, 7, 30, 90, 365];

export interface StorageUsage {
	areas: { name: string; bytes: number }[];
	totalBytes: number;
}

export interface DataApi {
	listScopes: () => Promise<DataScope[]>;
	getStorageUsage: () => Promise<StorageUsage>;
	export: (scope: DataScope) => Promise<DataExportResult | undefined>;
	exportAll: () => Promise<DataExportResult | undefined>;
	previewPurge: (scope: DataScope) => Promise<DataPurgePreview>;
	purge: (scope: DataScope, confirmationId: string) => Promise<DataPurgeResult | undefined>;
}
