import { z } from 'zod';

export const mapSchema = z.object({
	latitude: z.number().min(-90).max(90).describe('Map center latitude in degrees.'),
	longitude: z.number().min(-180).max(180).describe('Map center longitude in degrees.'),
	zoom: z.number().int().min(0).max(19).optional().describe('Initial zoom level.'),
	title: z.string().trim().min(1).max(200).optional(),
	markers: z.array(z.object({
		latitude: z.number().min(-90).max(90),
		longitude: z.number().min(-180).max(180),
		label: z.string().trim().min(1).max(200).optional(),
	})).max(100).optional(),
});
