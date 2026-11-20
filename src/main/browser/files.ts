import { statSync } from 'node:fs';
import path from 'node:path';
import { PROFILE_FILES, type Kind } from './formats';

export function profileFiles(directory: string, want: Readonly<Record<Kind, boolean>>): string[] {
	return Object.entries(PROFILE_FILES)
		.filter(([, kinds]) => kinds.some((kind) => want[kind]))
		.map(([name]) => path.join(directory, name))
		.filter((file) => statSync(file, { throwIfNoEntry: false })?.isFile());
}
