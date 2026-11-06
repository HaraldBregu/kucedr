import type { GoalStatus, SessionGoal } from './types';
import { readGoal } from './read';
import { writeGoal } from './write';

export function updateGoalStatus(
	sessionDirectory: string,
	status: GoalStatus,
	note?: string
): SessionGoal {
	const goal = readGoal(sessionDirectory);
	if (!goal) throw new Error('No goal exists for this conversation.');
	if (goal.status === 'completed' && status !== 'completed') {
		throw new Error('A completed goal cannot be resumed. Clear it first.');
	}
	const next = { ...goal, status, updatedAt: Date.now() };
	if (note?.trim()) next.statusNote = note.trim();
	return writeGoal(sessionDirectory, next);
}
