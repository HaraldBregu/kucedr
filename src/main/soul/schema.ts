import { z } from 'zod';

export const soulSchema = z.object({
	tone: z.string().trim().min(1),
	boundaries: z.string().trim().optional(),
	interactionStyle: z.string().trim().optional(),
	notes: z.string().trim().optional(),
});

export type SoulSettings = z.infer<typeof soulSchema>;
