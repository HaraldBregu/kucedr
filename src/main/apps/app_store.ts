import type { AppStoreValue } from '../../shared/app_store_types';
import { appDataRoot } from './app_data_root';
import { AppFileStorage } from './app_files';
import { AppValueStorage } from './app_values';

export class AppStorage {
	private readonly files: AppFileStorage;
	private readonly values: AppValueStorage;

	constructor(root = appDataRoot()) {
		this.files = new AppFileStorage(root);
		this.values = new AppValueStorage(root);
	}

	get<T extends AppStoreValue = AppStoreValue>(
		appId: string,
		key: string
	): T | undefined {
		return this.values.get<T>(appId, key);
	}

	set(appId: string, key: string, value: AppStoreValue): void {
		this.values.set(appId, key, value);
	}

	delete(appId: string, key: string): void {
		this.values.delete(appId, key);
	}

	readFile(appId: string, filePath: string): Promise<Uint8Array> {
		return this.files.read(appId, filePath);
	}

	writeFile(appId: string, filePath: string, data: Uint8Array): Promise<void> {
		return this.files.write(appId, filePath, data);
	}

	deleteFile(appId: string, filePath: string): Promise<void> {
		return this.files.delete(appId, filePath);
	}
}
