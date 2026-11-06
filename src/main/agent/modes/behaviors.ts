import { goalBehavior } from './goal';
import type { ModeBehavior, ModeDefinition } from './types';

const BEHAVIORS: Record<NonNullable<ModeDefinition['behavior']>, ModeBehavior> = {
	goal: goalBehavior,
};

/** The host behaviors switched on by enabled modes. */
export function enabledBehaviors(modes: readonly ModeDefinition[]): ModeBehavior[] {
	return modes.flatMap((mode) => (mode.behavior ? [BEHAVIORS[mode.behavior]] : []));
}
