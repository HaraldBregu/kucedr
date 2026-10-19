import Store from 'electron-store';
import { pluginsRoot } from './plugins_root';

export const pluginsStore = new Store<{ disabled: string[] }>({
	name: 'settings',
	cwd: pluginsRoot(),
	accessPropertiesByDotNotation: false,
	defaults: { disabled: [] },
});
