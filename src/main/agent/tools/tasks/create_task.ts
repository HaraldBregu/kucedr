import { createTask } from '../../../tasks';
import { tool } from '../tool';
import { z } from 'zod';
import { createTaskRequestSchema } from './schema';

export const createTaskTool = tool({
	id: 'create_task',
	category: 'task',
	name: 'Create task',
	description:
		'Create and persist a reusable background agent task with a name, an instruction prompt, and optional description and cron schedule. Use when the user asks to create, schedule, automate, or regularly repeat work, for example: "Create a task that summarizes my inbox every weekday at 9 AM" or "Set up a weekly project-status task." New tasks are deliberately saved disabled; only the user can enable them, in Settings > Tasks.',
	inputSchema: z.object({
		request: createTaskRequestSchema.describe(
			'The persistent task definition, including what the background agent should do and, when requested, its cron schedule.'
		),
	}),
	execute: ({ request }) => createTask({ ...request, enabled: false }),
});
