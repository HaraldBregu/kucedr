import { getSoul } from '../../soul';

export function readSoul(workspacePath: string): Promise<string> {
	return getSoul(workspacePath);
}
