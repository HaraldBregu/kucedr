import { z } from 'zod';
import { tool } from '../tool';

export const requestUserInputTool = tool({
	id: 'ask',
	category: 'system',
	name: 'Request user input',
	description:
		'Pause Plan mode for one to three consequential questions. The interface adds an optional free-form Other choice to every question.',
	planSafe: true,
	inputSchema: z.object({
		questions: z
			.array(
				z.object({
					id: z.string().trim().min(1).max(64),
					header: z.string().trim().min(1).max(12),
					question: z.string().trim().min(1).max(500),
					options: z
						.array(
							z.object({
								label: z.string().trim().min(1).max(80),
								description: z.string().trim().min(1).max(240),
							})
						)
						.min(2)
						.max(3),
				})
			)
			.min(1)
			.max(3)
			.refine(
				(questions) => new Set(questions.map((question) => question.id)).size === questions.length,
				'Question IDs must be unique.'
			),
	}),
	execute: () => {
		throw new Error('Structured input must be executed by the agent runtime.');
	},
});
