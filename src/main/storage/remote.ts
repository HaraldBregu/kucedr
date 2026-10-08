import type { StorageObjectInfo } from '../../shared/storage_types';

export interface StorageObjectStore {
	putFile?(key: string, filePath: string): Promise<void>;
	getFile?(key: string, filePath: string): Promise<void>;
	get(key: string): Promise<Uint8Array>;
	list(prefix?: string): Promise<StorageObjectInfo[]>;
	put(key: string, data: Uint8Array, contentType?: string): Promise<void>;
}
