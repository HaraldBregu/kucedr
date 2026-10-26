import electronUpdater from 'electron-updater';
import type { EventBus } from './event_bus';
import type { LoggerService } from './shared';
import { AppChannels } from '../shared/ipc_channels_definitions';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

export const { autoUpdater } = electronUpdater;

export let availableUpdateVersion: string | null = null;

export function startUpdater(eventBus: EventBus, logger: LoggerService): void {
	autoUpdater.autoDownload = false;
	autoUpdater.allowPrerelease = true;
	autoUpdater.on('update-available', (info) => {
		availableUpdateVersion = info.version;
		eventBus.broadcast(AppChannels.updateAvailable, info.version);
	});
	const check = (): void => {
		autoUpdater
			.checkForUpdates()
			.catch((error) => logger.warn('Updater', 'Update check failed', error));
	};
	check();
	setInterval(check, CHECK_INTERVAL_MS);
}
