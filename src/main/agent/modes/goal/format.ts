import type { SessionGoal } from './types';

export function formatGoal(goal: SessionGoal | undefined): string {
	if (!goal) return 'No goal set. Start one with `/goal <objective>`.';
	const complete = goal.criteria.filter((criterion) => criterion.satisfied).length;
	const lines = [
		`Goal: ${goal.objective}`,
		`Status: ${goal.status.replace('_', ' ')}`,
		`Criteria: ${complete}/${goal.criteria.length}`,
		`Usage: ${goal.usage.runs}/${goal.limits.maxRuns} runs, ${goal.usage.toolCalls} tool calls`,
	];
	if (goal.statusNote) lines.push(`Note: ${goal.statusNote}`);
	return lines.join('\n');
}
