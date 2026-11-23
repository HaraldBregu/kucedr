import { closeSync, fsyncSync, openSync, renameSync, writeFileSync } from 'node:fs';
import { restrictSettingsFile } from '../shared/restrict_settings_file';

// Writes to a temporary file in the same folder, flushes it to disk, then renames it over the
// target, so a crash or power cut mid-write cannot leave a half-written (corrupt) store behind.
// Rename is atomic on one volume.
export function writeFileAtomic(file: string, data: string | Buffer): void {
	const temp = `${file}.${process.pid}.tmp`;
	restrictSettingsFile(file);
	const descriptor = openSync(temp, 'w', 0o600);
	try {
		writeFileSync(descriptor, data);
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
	renameSync(temp, file);
}
