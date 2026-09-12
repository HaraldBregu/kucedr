export type DataScope =
	| { kind: 'rag'; mode: 'local_index'; indexName: string }
	| { kind: 'rag'; mode: 'local_namespace'; indexName: string; generation: string }
	| { kind: 'rag'; mode: 'remote_namespace'; indexName: string; generation: string }
	| { kind: 'rag'; mode: 'remote_all_namespaces'; indexName: string }
	| { kind: 'memory' }
	| { kind: 'sessions'; sessionIds: string[] };

export interface DataExportResult {
	scope: DataScope;
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

export interface DataApi {
	listScopes: () => Promise<DataScope[]>;
	export: (scope: DataScope) => Promise<DataExportResult | undefined>;
	previewPurge: (scope: DataScope) => Promise<DataPurgePreview>;
	purge: (scope: DataScope, confirmationId: string) => Promise<DataPurgeResult | undefined>;
}
