import { readGoal } from './read';

export function goalContext(sessionDirectory: string): string {
	const goal = readGoal(sessionDirectory);
	if (!goal || goal.status !== 'active') return '';
	const criteria = goal.criteria
		.map((item) => `- [${item.satisfied ? 'x' : ' '}] ${item.id}: ${item.description}`)
		.join('\n');
	return `<active_goal>\nObjective: ${goal.objective}\nSuccess criteria:\n${criteria}\nRemaining runs: ${Math.max(0, goal.limits.maxRuns - goal.usage.runs)}\nUse goal tools to maintain the plan and evidence. Request completion only after every criterion has concrete tool-derived evidence.\n</active_goal>`;
}
