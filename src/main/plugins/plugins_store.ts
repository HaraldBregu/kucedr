import Store from 'electron-store';
import { pluginsRoot } from './plugins_root';

export const pluginsStore = new Store<{
	disabled: string[];
	settings: Record<string, Record<string, string>>;
}>({
	name: 'settings',
	cwd: pluginsRoot(),
	accessPropertiesByDotNotation: false,
	defaults: { disabled: [], settings: {} },
});
