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
	paths: string[];
	syncEnabled: boolean;
	syncCronExpression: string;
}

export interface StorageSyncFolder {
	key: 'agent' | 'sessions' | 'library' | 'wiki' | 'skills';
	path: string;
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
