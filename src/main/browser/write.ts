import { renameSync, writeFileSync } from 'node:fs';
import { restrictSettingsFile } from '../shared/restrict_settings_file';

// Writes to a temporary file in the same folder, then renames it over the target, so a crash
// mid-write cannot leave a half-written (corrupt) store behind. Rename is atomic on one volume.
export function writeFileAtomic(file: string, data: string | Buffer): void {
	const temp = `${file}.${process.pid}.tmp`;
	restrictSettingsFile(file);
	writeFileSync(temp, data, { mode: 0o600 });
	renameSync(temp, file);
}
