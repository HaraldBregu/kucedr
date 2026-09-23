import { watch, type FSWatcher } from 'chokidar';
import type { AuthService } from '../../cloud/service';
import { readStorageConfig } from '../local/config';
import { runStorageSync } from '../storage_auto_sync';
import { isProtectedStoragePath } from '../storage_protected';
import type { StorageOperations } from '../storage_operations';
import type { StorageSyncLogger } from '../storage_sync_types';

export function startVersionedStorageWatch(
	auth: AuthService,
	logger: StorageSyncLogger,
	operations: StorageOperations
): () => void {
	let watcher: FSWatcher | undefined;
	let roots = '';
	let debounce: ReturnType<typeof setTimeout> | undefined;
	let refreshing = false;
	const trigger = (): void => {
		if (debounce) clearTimeout(debounce);
		debounce = setTimeout(() => void runStorageSync(logger, operations), 700);
	};
	const refresh = async (): Promise<void> => {
		if (refreshing) return;
		refreshing = true;
		try {
			const config = auth.getSignedInUserId() ? await readStorageConfig() : undefined;
			const next = config?.sync.enabled
				? JSON.stringify(config.workspaces.map((entry) => entry.rootPath).sort()) : '';
			if (next === roots) return;
			await watcher?.close();
			watcher = undefined;
			roots = next;
			if (!next) return;
			watcher = watch(JSON.parse(next) as string[], {
				ignoreInitial: true,
				followSymlinks: false,
				ignored: isProtectedStoragePath,
				awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
			});
			watcher.on('add', trigger).on('change', trigger).on('unlink', trigger);
			trigger();
		} catch (error) {
			logger.error('Storage', 'Storage watcher failed', error);
		} finally {
			refreshing = false;
		}
	};
	const unsubscribe = auth.onStateChanged(() => void refresh());
	const interval = setInterval(() => void refresh(), 10_000);
	const retry = setInterval(() => {
		if (roots) void runStorageSync(logger, operations);
	}, 60_000);
	void refresh();
	return () => {
		unsubscribe();
		clearInterval(interval);
		clearInterval(retry);
		if (debounce) clearTimeout(debounce);
		void watcher?.close();
	};
}
