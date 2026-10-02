import { getSoul, type SoulSettings } from '../../soul';

export function readSoul(workspacePath: string): Promise<SoulSettings | null> {
	return getSoul(workspacePath);
}
