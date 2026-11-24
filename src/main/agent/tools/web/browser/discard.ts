import { rmdirSync, rmSync } from 'node:fs';
import path from 'node:path';

// Removes a held download and its holding folder once that folder is empty.
export function discardDownload(file: string): void {
	rmSync(file, { force: true });
	try {
		rmdirSync(path.dirname(file));
	} catch {
		// Not empty yet (the browser may still be writing); the temporary folder is left to the system.
	}
}
