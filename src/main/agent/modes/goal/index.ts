import type { ModeBehavior } from '../types';
import { accountGoalRun } from './account';
import { applyGoalCommand } from './apply';
import { goalContext } from './context';
import { parseGoalCommand } from './parse';
import { readGoal } from './read';
import { goalTools } from './tools';

export const goalBehavior: ModeBehavior = {
	id: 'goal',
	category: {
		label: 'Goals',
		description:
			'Create and track long-running goals, update their plans, record evidence, and report completion or blockers.',
	},
	catalog: () => goalTools(''),
	parse(message) {
		const command = parseGoalCommand(message);
		return {
			message: command.action === 'create' ? command.objective : message,
			continues: command.action === 'create',
			apply: (sessionDirectory) => applyGoalCommand(sessionDirectory, command),
		};
	},
	tools: (sessionDirectory) =>
		readGoal(sessionDirectory)?.status === 'active' ? goalTools(sessionDirectory) : [],
	context: goalContext,
	account: accountGoalRun,
};
