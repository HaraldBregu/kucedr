export interface StorageProvider {
	id: string;
	name: string;
	endpoint: string;
	region: string;
	bucket: string;
	accessKeyId: string;
	forcePathStyle: boolean;
	hasSecretAccessKey: boolean;
}

export type StorageProviderInput = Omit<StorageProvider, 'id' | 'hasSecretAccessKey'> & {
	id?: string;
	secretAccessKey?: string;
};

export interface StorageSyncSettings {
	providerId?: string;
	paths: string[];
	syncEnabled: boolean;
	syncCronExpression: string;
}

export interface StorageSyncFolder {
	key: 'agent' | 'sessions' | 'library' | 'skills';
	path: string;
}

export interface StorageConflict {
	workspaceId: string;
	fileId: string;
	versionId: string;
	path: string | null;
	kind: 'content' | 'rename' | 'tombstone' | 'restore';
}

export interface StorageObjectInfo {
	key: string;
	size: number;
	lastModified: string | undefined;
}

export interface StoragePushFailure {
	path: string;
	error: string;
}

export interface StoragePushResult {
	uploaded: string[];
	failed: StoragePushFailure[];
}

export interface StoragePullResult {
	downloaded: string[];
	skipped: string[];
	failed: StoragePushFailure[];
}

export interface StorageBackupSnapshot {
	key: string;
	folder: string;
	createdAt: string;
	files: number;
	bytes: number;
}

export interface StorageRestoreInput {
	snapshotKey: string;
	path: string;
}

export type StorageOperation = 'backup' | 'restore';
export type StorageOperationTrigger = 'manual' | 'scheduled';
export type StorageOperationState = 'running' | 'succeeded' | 'partial' | 'failed';

export interface StorageOperationStatus {
	operationId: string;
	operation: StorageOperation;
	trigger: StorageOperationTrigger;
	state: StorageOperationState;
	startedAt: string;
	finishedAt?: string;
	transferred: number;
	skipped: number;
	failed: number;
	error?: string;
	revision: number;
}
