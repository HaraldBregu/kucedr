import path from 'node:path';
import { resourceRoot } from '../shared/resource_root';

export function bundledPluginsRoot(): string {
	return path.join(resourceRoot(), 'plugins');
}
