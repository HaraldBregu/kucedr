import { clearGoal } from './clear';
import { createGoal } from './create';
import { formatGoal } from './format';
import type { GoalCommand } from './parse';
import { readGoal } from './read';
import { updateGoalStatus } from './status';

export function applyGoalCommand(sessionDirectory: string, command: GoalCommand): string {
	if (command.action === 'create') return formatGoal(createGoal(sessionDirectory, command.objective));
	if (command.action === 'pause') {
		return formatGoal(updateGoalStatus(sessionDirectory, 'paused', command.note));
	}
	if (command.action === 'resume') {
		return formatGoal(updateGoalStatus(sessionDirectory, 'active', command.note));
	}
	if (command.action === 'clear') {
		clearGoal(sessionDirectory);
		return 'Goal cleared.';
	}
	return formatGoal(readGoal(sessionDirectory));
}
