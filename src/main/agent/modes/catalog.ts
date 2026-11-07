import type { Tool } from '../types';
import { BEHAVIORS } from './behaviors';

export function behaviorTools(): Tool[] {
	return Object.values(BEHAVIORS).flatMap((behavior) => behavior.catalog());
}
