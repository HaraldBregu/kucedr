import { lstatSync, readdirSync } from 'node:fs';
import path from 'node:path';

export function assertNoLinks(directory: string, root = directory): void {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const target = path.join(directory, entry.name);
		if (lstatSync(target).isSymbolicLink()) {
			throw new Error(`Plugins cannot contain links: ${path.relative(root, target)}`);
		}
		if (entry.isDirectory()) assertNoLinks(target, root);
	}
}
