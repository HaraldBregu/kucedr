import { z } from 'zod';

export const backupSnapshotSchema = z.object({
	version: z.literal(2),
	createdAt: z.string().datetime(),
	folder: z.string().optional(),
	files: z.array(
		z.object({
			path: z.string().min(1),
			key: z.string().min(1),
			size: z.number().int().nonnegative(),
			sha256: z.string().regex(/^[a-f0-9]{64}$/),
			mode: z.number().int().min(0).max(0o777).optional(),
			modifiedAt: z.number().nonnegative().max(8.64e15).optional(),
		})
	),
});

export type BackupSnapshot = z.infer<typeof backupSnapshotSchema>;
