import { watch } from 'chokidar';
import path from 'node:path';
import { appsRoot } from './app_root';

const updateDelay = 150;

export function watchApps(
	onChange: () => void,
	onError: (error: unknown) => void,
	appLocation?: string
): () => Promise<void> {
	let updateTimer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;
	const root = appsRoot(appLocation);
	const watcher = watch(root, {
		ignoreInitial: true,
		followSymlinks: false,
		ignored: (watchPath) => path.relative(root, watchPath).split(path.sep)[1] === 'data',
		awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 25 },
	});

	watcher.on('all', () => {
		if (stopped) return;
		if (updateTimer) clearTimeout(updateTimer);
		updateTimer = setTimeout(onChange, updateDelay);
	});
	watcher.on('error', onError);

	return async (): Promise<void> => {
		stopped = true;
		if (updateTimer) clearTimeout(updateTimer);
		await watcher.close();
	};
}
