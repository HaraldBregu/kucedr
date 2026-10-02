import { z } from 'zod';

export const identitySchema = z.object({
	name: z.string().trim().min(1),
	role: z.string().trim().min(1),
	avatar: z.string().trim().optional(),
	vibe: z.string().trim().optional(),
	metadata: z.string().trim().optional(),
});

export type IdentitySettings = z.infer<typeof identitySchema>;
