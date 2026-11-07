import type { z } from 'zod';
import type { itemSchema, stateSchema } from './schema';

export type ModeStateItem = z.infer<typeof itemSchema>;
export type ModeState = z.infer<typeof stateSchema>;
