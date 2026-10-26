import { EventEmitter } from 'node:events';
import { AppChannels } from '../../../../src/shared/ipc_channels_definitions';
import type { EventBus } from '../../../../src/main/event_bus';
import type { LoggerService } from '../../../../src/main/shared';

const mockAutoUpdater = Object.assign(new EventEmitter(), {
	autoDownload: true,
	allowPrerelease: false,
	checkForUpdates: jest.fn(),
});

jest.mock('electron-updater', () => ({ autoUpdater: mockAutoUpdater }));

import * as updater from '../../../../src/main/updater';

const broadcast = jest.fn();
const warn = jest.fn();
const eventBus = { broadcast } as unknown as EventBus;
const logger = { warn } as unknown as LoggerService;

describe('updater', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockAutoUpdater.removeAllListeners();
		mockAutoUpdater.checkForUpdates.mockResolvedValue(null);
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	it('checks for prereleases without downloading them', () => {
		updater.startUpdater(eventBus, logger);

		expect(mockAutoUpdater.autoDownload).toBe(false);
		expect(mockAutoUpdater.allowPrerelease).toBe(true);
		expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
	});

	it('checks again every 4 hours', () => {
		updater.startUpdater(eventBus, logger);

		jest.advanceTimersByTime(4 * 60 * 60 * 1000);

		expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
	});

	it('broadcasts and remembers an available version', () => {
		updater.startUpdater(eventBus, logger);

		mockAutoUpdater.emit('update-available', { version: '9.9.9' });

		expect(broadcast).toHaveBeenCalledWith(AppChannels.updateAvailable, '9.9.9');
		expect(updater.availableUpdateVersion).toBe('9.9.9');
	});

	it('logs a failed check instead of throwing', async () => {
		const error = new Error('offline');
		mockAutoUpdater.checkForUpdates.mockRejectedValue(error);

		updater.startUpdater(eventBus, logger);
		await Promise.resolve();

		expect(warn).toHaveBeenCalledWith('Updater', 'Update check failed', error);
	});
});
