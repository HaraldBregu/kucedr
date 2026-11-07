import { goalBehavior } from './goal';
import type { ModeBehavior, ModeDefinition } from './types';

export const BEHAVIORS: Readonly<Record<string, ModeBehavior>> = Object.fromEntries(
	[goalBehavior].map((behavior) => [behavior.id, behavior])
);

/** The host behaviors switched on by enabled modes. */
export function enabledBehaviors(modes: readonly ModeDefinition[]): ModeBehavior[] {
	return modes.flatMap((mode) => (mode.behavior ? [BEHAVIORS[mode.behavior]] : []));
}
