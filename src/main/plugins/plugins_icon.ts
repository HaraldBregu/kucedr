import { readFileSync } from 'node:fs';
import path from 'node:path';

const MIME: Record<string, string> = {
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
};

export function pluginIcon(file: string): string {
	const mime = MIME[path.extname(file).toLowerCase()];
	return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}
