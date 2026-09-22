import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Tool } from '../types';
import { tool } from '../tools/tool';
import { readGoal } from './read';
import { updateGoalStatus } from './status';
import { writeGoal } from './write';

export function goalTools(sessionDirectory: string): Tool[] {
	return [
		tool({
			id: 'get_goal',
			name: 'get_goal',
			description: 'Read the active conversation goal, criteria, plan, evidence, and budget.',
			inputSchema: z.object({}),
			execute: () => readGoal(sessionDirectory) ?? { goal: null },
		}),
		tool({
			id: 'update_goal_plan',
			name: 'update_goal_plan',
			description: 'Replace the operational steps for the active goal. Do not change its success criteria.',
			inputSchema: z.object({
				steps: z.array(z.object({ description: z.string().min(1), status: z.enum(['pending', 'active', 'completed']) })).max(12),
			}),
			execute: ({ steps }) => {
				const goal = readGoal(sessionDirectory);
				if (!goal || goal.status !== 'active') throw new Error('No active goal.');
				return writeGoal(sessionDirectory, {
					...goal,
					steps: steps.map((step, index) => ({ id: `step-${index + 1}`, ...step })),
					updatedAt: Date.now(),
				});
			},
		}),
		tool({
			id: 'record_goal_evidence',
			name: 'record_goal_evidence',
			description: 'Record concise evidence obtained from tool output for a goal criterion.',
			inputSchema: z.object({ criterionId: z.string(), source: z.string(), summary: z.string().min(1).max(1000) }),
			execute: ({ criterionId, source, summary }) => {
				const goal = readGoal(sessionDirectory);
				if (!goal || goal.status !== 'active') throw new Error('No active goal.');
				const criterion = goal.criteria.find((item) => item.id === criterionId);
				if (!criterion) throw new Error('Unknown goal criterion.');
				const evidence = { id: randomUUID(), source, summary, createdAt: Date.now() };
				criterion.evidenceIds.push(evidence.id);
				criterion.satisfied = true;
				goal.evidence.push(evidence);
				goal.updatedAt = Date.now();
				return writeGoal(sessionDirectory, goal);
			},
		}),
		tool({
			id: 'request_goal_completion',
			name: 'request_goal_completion',
			description: 'Request completion. The runtime rejects completion unless every criterion has recorded evidence.',
			inputSchema: z.object({ summary: z.string().min(1).max(1000) }),
			execute: ({ summary }) => {
				const goal = readGoal(sessionDirectory);
				if (!goal || goal.status !== 'active') throw new Error('No active goal.');
				const unsupported = goal.criteria.filter((item) => !item.satisfied || item.evidenceIds.length === 0);
				if (unsupported.length) return { completed: false, missingCriteria: unsupported.map((item) => item.id) };
				return { completed: true, goal: updateGoalStatus(sessionDirectory, 'completed', summary) };
			},
		}),
		tool({
			id: 'report_goal_blocker',
			name: 'report_goal_blocker',
			description: 'Stop an active goal when a concrete blocker prevents further progress.',
			inputSchema: z.object({ reason: z.string().min(1).max(1000) }),
			execute: ({ reason }) => updateGoalStatus(sessionDirectory, 'blocked', reason),
		}),
	];
}
