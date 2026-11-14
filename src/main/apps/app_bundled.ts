import path from 'node:path';
import { bundledPluginsRoot } from '../plugins/plugins_bundled_root';
import { appDirectory } from './app_directory';

export function isBundledApp(id: string): boolean {
	const relative = path.relative(path.resolve(bundledPluginsRoot()), path.resolve(appDirectory(id)));
	return (
		!!relative &&
		relative !== '..' &&
		!relative.startsWith(`..${path.sep}`) &&
		!path.isAbsolute(relative)
	);
}
