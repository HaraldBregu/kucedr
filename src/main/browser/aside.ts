import { existsSync, renameSync } from 'node:fs';

export function aside(file: string): void {
	if (existsSync(file)) renameSync(file, `${file}.damaged-${new Date().toISOString().replace(/[:.]/g, '-')}`);
}
