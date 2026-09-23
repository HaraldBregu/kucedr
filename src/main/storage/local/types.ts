export interface StorageScope {
	accountId: string;
	workspaceId: string;
}

export interface StorageConfig {
	version: 1;
	provider: 's3';
	s3: { bucket: string; region: string; prefix: string };
	supabase: { url: string };
	sync: { enabled: boolean; maxCacheBytes: number };
	workspaces: Array<{ id: string; rootPath: string }>;
}

export interface LocalSnapshotInput extends StorageScope {
	fileId: string;
	versionId: string;
	operationId: string;
	path: string;
	parentIds: string[];
	deviceId: string;
	content?: Uint8Array;
	deviceId: string;
	kind?: 'content' | 'rename' | 'tombstone' | 'restore';
}

export interface LocalSnapshotResult {
	hash: string | null;
	size: number | null;
	blobPath: string | null;
	status: 'pending';
}

export interface PendingOperation extends StorageScope {
	operationId: string;
	fileId: string;
	versionId: string;
	hash: string | null;
	size: number | null;
	blobPath: string | null;
	status: 'pending' | 'uploaded';
	attempts: number;
	nextRetryAt: string | null;
	kind: 'content' | 'rename' | 'tombstone' | 'restore';
	path: string;
	parentIds: string[];
	uploadedBytes: number;
	objectKey: string | null;
}
