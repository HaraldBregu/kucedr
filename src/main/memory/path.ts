import path from 'node:path';
import type { Config } from '../agent/types';

export function memoryPath(config: Config): string {
	return path.join(path.resolve(config.location), 'MEMORY.md');
}
