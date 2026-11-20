import { statSync } from 'node:fs';
import path from 'node:path';
import { PROFILE_FILES, type Kind } from './formats';

export function profileFiles(directory: string, want: Readonly<Record<Kind, boolean>>): string[] {
	const present = new Set(
		Object.keys(PROFILE_FILES).filter((name) =>
			statSync(path.join(directory, name), { throwIfNoEntry: false })?.isFile()
		)
	);
	return [...present]
		// A ".bak" copy is a fallback: skip it when the live file beside it is present.
		.filter((name) => !(name.endsWith('.bak') && present.has(name.slice(0, -4))))
		.filter((name) => PROFILE_FILES[name].some((kind) => want[kind]))
		.map((name) => path.join(directory, name));
}
