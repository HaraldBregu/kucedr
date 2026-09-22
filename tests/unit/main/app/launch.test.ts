import path from 'node:path';

let mockAppStore: Record<string, unknown> = {};

jest.mock('electron-store', () =>
	jest.fn().mockImplementation(
		({ name, cwd, defaults }: { name: string; cwd?: string; defaults: object }) => {
			let backing: Record<string, unknown> = { ...defaults };
			if (name === 'settings') mockAppStore = backing;
			return {
				path: `${cwd ?? '/tmp'}/${name}.json`,
				get(key: string) {
					return backing[key];
				},
				set(key: string, value: unknown) {
					backing[key] = value;
				},
				get store() {
					return backing;
				},
				set store(value: Record<string, unknown>) {
					backing = value;
					if (name === 'settings') mockAppStore = backing;
				},
			};
		}
	)
);

import {
	appSettingsStorePath,
	getLaunchState,
	recordAppLaunch,
} from '../../../../src/main/settings_store';
import { userDataLocation } from '../../../../src/main/shared/user_data_location';

beforeEach(() => {
	mockAppStore.launchCount = 0;
});

it('stores app settings under the apps folder', () => {
	expect(appSettingsStorePath).toBe(path.join(userDataLocation(), 'apps', 'settings.json'));
});

it('records the initial launch as the first launch', () => {
	expect(recordAppLaunch()).toEqual({ launchCount: 1, isFirstLaunch: true });
	expect(mockAppStore.launchCount).toBe(1);
});

it('persists and increments later launches', () => {
	recordAppLaunch();

	expect(recordAppLaunch()).toEqual({ launchCount: 2, isFirstLaunch: false });
	expect(mockAppStore.launchCount).toBe(2);
});

it('increments a persisted ninth launch to ten', () => {
	mockAppStore.launchCount = 9;

	expect(recordAppLaunch()).toEqual({ launchCount: 10, isFirstLaunch: false });
	expect(mockAppStore.launchCount).toBe(10);
});

it('reads launch state without incrementing it', () => {
	recordAppLaunch();

	expect(getLaunchState()).toEqual({ launchCount: 1, isFirstLaunch: true });
	expect(getLaunchState()).toEqual({ launchCount: 1, isFirstLaunch: true });
	expect(mockAppStore.launchCount).toBe(1);
});
