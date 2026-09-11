import { lstatSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import Store from 'electron-store';
import type { AppStoreValue } from '../../shared/app_store_types';
import { isAppStoreValue } from '../../shared/app_store_value';
import { isAppId } from './app_id';

type AppStoreState = Record<string, AppStoreValue>;

export class AppValueStorage {
	private readonly stores = new Map<string, Store<AppStoreState>>();

	constructor(private readonly root: string) {}

	get<T extends AppStoreValue = AppStoreValue>(
		appId: string,
		key: string
	): T | undefined {
		this.validateKey(key);
		return this.store(appId).get(key) as T | undefined;
	}

	set(appId: string, key: string, value: AppStoreValue): void {
		this.validateKey(key);
		if (!isAppStoreValue(value)) throw new Error('Invalid app store value.');
		this.store(appId).set(key, value);
	}

	delete(appId: string, key: string): void {
		this.validateKey(key);
		this.store(appId).delete(key);
	}

	private store(appId: string): Store<AppStoreState> {
		const existing = this.stores.get(appId);
		if (existing) {
			this.assertDirectory(this.root);
			this.assertDirectory(this.namespace(appId));
			this.assertStoreFile(existing.path);
			return existing;
		}

		const directory = this.ensureDirectory(appId);
		const storePath = path.join(directory, 'store.json');
		this.assertStoreFile(storePath);
		const created = new Store<AppStoreState>({
			name: 'store',
			cwd: directory,
			accessPropertiesByDotNotation: false,
			clearInvalidConfig: false,
			configFileMode: 0o600,
		});
		this.stores.set(appId, created);
		return created;
	}

	private ensureDirectory(appId: string): string {
		const directory = this.namespace(appId);
		mkdirSync(this.root, { recursive: true });
		this.assertDirectory(this.root);
		try {
			mkdirSync(directory);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		}
		this.assertDirectory(directory);
		return directory;
	}

	private namespace(appId: string): string {
		if (!isAppId(appId)) throw new Error('Invalid app ID.');
		return path.join(this.root, appId, 'data');
	}

	private assertDirectory(directory: string): void {
		const stats = lstatSync(directory);
		if (stats.isSymbolicLink() || !stats.isDirectory()) {
			throw new Error('Invalid app storage directory.');
		}
	}

	private assertStoreFile(filePath: string): void {
		try {
			const stats = lstatSync(filePath);
			if (stats.isSymbolicLink() || !stats.isFile()) {
				throw new Error('Invalid app store file.');
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
	}

	private validateKey(key: string): void {
		if (
			typeof key !== 'string' ||
			key.length === 0 ||
			key.includes('\0') ||
			key === '__proto__' ||
			key === 'constructor' ||
			key === 'prototype' ||
			key === '__internal__' ||
			key.startsWith('__internal__.')
		) {
			throw new Error('Invalid app store key.');
		}
	}
}
