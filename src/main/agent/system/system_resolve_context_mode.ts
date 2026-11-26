import type { AgentContextMode } from '../../../shared/agent_types';
import type { SessionCategory } from '../session';
import type { Config } from '../types';
import { profileLocation } from './system_profile_location';
import { readBootstrap } from './system_read_bootstrap';

export async function resolveContextMode(
	config: Config,
	requestedMode: AgentContextMode,
	category: SessionCategory,
	restricted: boolean,
	hasCustomInstructions: boolean
): Promise<AgentContextMode> {
	if (
		requestedMode === 'workspace' ||
		category !== 'main' ||
		restricted ||
		hasCustomInstructions
	) {
		return requestedMode;
	}

	const bootstrap = await readBootstrap(profileLocation(config));
	return bootstrap.trim() ? 'workspace' : requestedMode;
}
