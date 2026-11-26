import { chmodSync, mkdirSync } from 'node:fs';
import { currentWorkspace } from '../../../workspaces/current';

export function ragLocation(): string {
	const location = currentWorkspace().rag;
	mkdirSync(location, { recursive: true, mode: 0o700 });
	chmodSync(location, 0o700);
	return location;
}
