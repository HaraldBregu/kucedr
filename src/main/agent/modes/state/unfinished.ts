import type { ModeDefinition } from '../types';
import { readState } from './read';

/** Modes on for this run that keep it going until their state is completed or blocked. */
export function unfinishedModes(
	sessionDirectory: string,
	activeIds: readonly string[],
	modes: readonly ModeDefinition[]
): ModeDefinition[] {
	return modes.filter((mode) => {
		if (!mode.state?.continue || !activeIds.includes(mode.id)) return false;
		const status = readState(sessionDirectory, mode.id)?.status;
		return status !== 'completed' && status !== 'blocked';
	});
}
