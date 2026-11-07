import type { ModeDefinition } from '../types';
import { readState } from './read';

/** Stateful modes switched on for this run, plus those whose saved state is still active. */
export function trackedModes(
	sessionDirectory: string,
	activeIds: readonly string[],
	available: readonly ModeDefinition[]
): ModeDefinition[] {
	return available.filter(
		(mode) =>
			mode.state &&
			(activeIds.includes(mode.id) || readState(sessionDirectory, mode.id)?.status === 'active')
	);
}
