import path from 'node:path';
import { watch } from 'chokidar';
import { watchApps } from '../../../../src/main/apps/app_watch';

jest.mock('chokidar', () => ({ watch: jest.fn() }));

type WatchHandler = (...args: unknown[]) => void;

describe('app folder watcher', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('coalesces app changes and forwards watcher errors', async () => {
		const handlers = new Map<string, WatchHandler>();
		const watcher = {
			on: jest.fn((event: string, handler: WatchHandler) => {
				handlers.set(event, handler);
				return watcher;
			}),
			close: jest.fn(async () => undefined),
		};
		jest.mocked(watch).mockReturnValue(watcher as never);
		const onChange = jest.fn();
		const onError = jest.fn();

		const stop = watchApps(onChange, onError, '/tmp/kucedr');

		expect(watch).toHaveBeenCalledWith(path.join('/tmp/kucedr', 'apps'), {
			ignoreInitial: true,
			followSymlinks: false,
			ignored: expect.any(Function),
			awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 25 },
		});
		const ignored = (jest.mocked(watch).mock.calls[0][1] as { ignored: (watchPath: string) => boolean }).ignored;
		expect(ignored(path.join('/tmp/kucedr', 'apps', 'project', 'data', 'store.json'))).toBe(true);
		expect(ignored(path.join('/tmp/kucedr', 'apps', 'project', 'manifest.json'))).toBe(false);
		handlers.get('all')?.('addDir', 'project');
		handlers.get('all')?.('add', 'project/manifest.json');
		jest.advanceTimersByTime(149);
		expect(onChange).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);
		expect(onChange).toHaveBeenCalledTimes(1);
		const error = new Error('watch failed');
		handlers.get('error')?.(error);
		expect(onError).toHaveBeenCalledWith(error);

		handlers.get('all')?.('unlinkDir', 'project');
		await stop();
		jest.runOnlyPendingTimers();
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(watcher.close).toHaveBeenCalledTimes(1);
	});
});
