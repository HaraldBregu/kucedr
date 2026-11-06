import type { SessionUsage } from '../session';
import { readGoal } from './read';
import { writeGoal } from './write';

export function accountGoalRun(
	sessionDirectory: string,
	usage: SessionUsage,
	toolCalls: number
): void {
	const goal = readGoal(sessionDirectory);
	if (!goal || goal.status !== 'active') return;
	goal.usage.runs += 1;
	goal.usage.inputTokens += usage.inputTokens;
	goal.usage.outputTokens += usage.outputTokens;
	goal.usage.toolCalls += toolCalls;
	goal.updatedAt = Date.now();
	const tokens = goal.usage.inputTokens + goal.usage.outputTokens;
	if (
		goal.usage.runs >= goal.limits.maxRuns ||
		(goal.limits.maxTokens !== undefined && tokens >= goal.limits.maxTokens) ||
		(goal.limits.maxToolCalls !== undefined && goal.usage.toolCalls >= goal.limits.maxToolCalls)
	) {
		goal.status = 'budget_limited';
		goal.statusNote = 'Goal execution budget exhausted.';
	}
	writeGoal(sessionDirectory, goal);
}
