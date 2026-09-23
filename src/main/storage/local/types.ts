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
}

export interface LocalSnapshotInput extends StorageScope {
	fileId: string;
	versionId: string;
	operationId: string;
	path: string;
	parentIds: string[];
	content: Uint8Array;
	deviceId: string;
}

export interface LocalSnapshotResult {
	hash: string;
	size: number;
	blobPath: string;
	status: 'pending';
}

export interface PendingOperation extends StorageScope {
	operationId: string;
	fileId: string;
	versionId: string;
	hash: string;
	size: number;
	blobPath: string;
	status: 'pending' | 'uploaded';
	attempts: number;
	nextRetryAt: string | null;
}
