import path from 'node:path';
import Store from 'electron-store';
import { userDataLocation } from '../shared/user_data_location';

export const debugAppsStore = new Store<{ paths: string[] }>({
	name: 'apps-debug',
	cwd: path.resolve(userDataLocation(), 'settings'),
	accessPropertiesByDotNotation: false,
	defaults: { paths: [] },
});
