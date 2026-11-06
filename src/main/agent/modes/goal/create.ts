import { randomUUID } from 'node:crypto';
import { readGoal } from './read';
import type { SessionGoal } from './types';
import { writeGoal } from './write';

export function createGoal(sessionDirectory: string, objective: string): SessionGoal {
	if (readGoal(sessionDirectory)) throw new Error('A goal already exists. Clear it first.');
	const value = objective.trim();
	if (!value) throw new Error('Goal objective is required.');
	const now = Date.now();
	return writeGoal(sessionDirectory, {
		schemaVersion: 1,
		id: randomUUID(),
		objective: value,
		status: 'active',
		criteria: [
			{ id: 'criterion-1', description: value, satisfied: false, evidenceIds: [] },
		],
		steps: [],
		evidence: [],
		limits: { maxRuns: 20 },
		usage: { runs: 0, inputTokens: 0, outputTokens: 0, toolCalls: 0 },
		createdAt: now,
		updatedAt: now,
	});
}
