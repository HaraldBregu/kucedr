export type AppStoreValue =
	| null
	| boolean
	| number
	| string
	| AppStoreValue[]
	| { [key: string]: AppStoreValue };

export interface AppStorageApi {
	getAppStoreValue<T extends AppStoreValue = AppStoreValue>(
		key: string
	): Promise<T | undefined>;
	setAppStoreValue(key: string, value: AppStoreValue): Promise<void>;
	deleteAppStoreValue(key: string): Promise<void>;
	readAppStoreFile(path: string): Promise<Uint8Array>;
	writeAppStoreFile(path: string, data: Uint8Array): Promise<void>;
	deleteAppStoreFile(path: string): Promise<void>;
}
