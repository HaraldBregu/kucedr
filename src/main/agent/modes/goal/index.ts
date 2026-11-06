import type { ModeBehavior } from '../types';
import { accountGoalRun } from './account';
import { applyGoalCommand } from './apply';
import { goalContext } from './context';
import { parseGoalCommand } from './parse';
import { readGoal } from './read';
import { goalTools } from './tools';

export const goalBehavior: ModeBehavior = {
	id: 'goal',
	parse(message) {
		const command = parseGoalCommand(`/goal ${message}`);
		if (!command) return undefined;
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
