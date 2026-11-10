import type { ModeDefinition } from '../types';
import { readState } from './read';

/** Modes on for this run that keep it going until this run completes or blocks their state. */
export function unfinishedModes(
	sessionDirectory: string,
	activeIds: readonly string[],
	modes: readonly ModeDefinition[],
	since: number
): ModeDefinition[] {
	return modes.filter((mode) => {
		if (!mode.state?.continue || !activeIds.includes(mode.id)) return false;
		const state = readState(sessionDirectory, mode.id);
		return !state || state.status === 'active' || state.updatedAt < since;
	});
}
