import Store from 'electron-store';
import { appsRoot } from './app_root';

export const debugAppsStore = new Store<{ paths: string[] }>({
	name: 'debug',
	cwd: appsRoot(),
	accessPropertiesByDotNotation: false,
	defaults: { paths: [] },
});
