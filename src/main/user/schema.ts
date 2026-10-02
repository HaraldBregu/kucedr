import { z } from 'zod';

export const userSchema = z.object({
	name: z.string().trim().min(1),
	preferredName: z.string().trim().optional(),
	pronouns: z.string().trim().optional(),
	timezone: z.string().trim().optional(),
	projects: z.string().trim().optional().describe('Projects the user explicitly chose to add to their profile, such as a project description. Never infer projects from workspace files or folders.'),
	preferences: z.string().trim().optional(),
	notes: z.string().trim().optional(),
});

export type UserSettings = z.infer<typeof userSchema>;
