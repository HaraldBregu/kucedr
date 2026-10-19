import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const ICON_MAX_BYTES = 256 * 1024;

export function assertIcon(directory: string, icon: string): void {
	const file = path.join(directory, icon);
	if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`Missing icon file ${icon}.`);
	if (statSync(file).size > ICON_MAX_BYTES) throw new Error(`${icon} must be 256 KB or smaller.`);
}
