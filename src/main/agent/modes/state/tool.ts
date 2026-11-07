import { z } from 'zod';
import type { Tool } from '../../types';
import { tool } from '../../tools/tool';
import type { ModeDefinition } from '../types';
import { readState } from './read';
import { itemSchema } from './schema';
import { writeState } from './write';

export const MODE_STATE_TOOL_ID = 'update_mode_state';

/** The one tool a stateful mode uses to record progress; the host enforces each mode's completion rule. */
export function modeStateTool(sessionDirectory: string, modes: readonly ModeDefinition[]): Tool {
	const ids = modes.map((mode) => mode.id) as [string, ...string[]];
	return tool({
		id: MODE_STATE_TOOL_ID,
		category: 'system',
		name: MODE_STATE_TOOL_ID,
		description:
			'Create or update the tracked state of an active mode: its objective, its ordered items with their status and evidence, and the overall status. Items replace the previous list.',
		readOnly: true,
		capability: { effects: ['persistence'] },
		inputSchema: z
			.object({
				mode: z.enum(ids),
				objective: z.string().trim().min(1).max(2000).optional(),
				items: z.array(itemSchema).max(30).optional(),
				status: z.enum(['active', 'completed', 'blocked']).optional(),
				note: z.string().trim().max(1000).optional(),
			})
			.strict(),
		execute: ({ mode: id, objective, items, status, note }) => {
			const mode = modes.find((candidate) => candidate.id === id)!;
			const previous = readState(sessionDirectory, id);
			const next = {
				mode: id,
				status: status ?? 'active',
				objective: objective ?? previous?.objective,
				items: items ?? previous?.items ?? [],
				...(note ? { note } : previous?.note ? { note: previous.note } : {}),
				updatedAt: Date.now(),
			};
			if (!next.objective) throw new Error('A new mode state needs an objective.');
			if (next.status === 'completed') {
				const open = next.items.flatMap((item, index) =>
					item.status !== 'done' || (mode.state?.evidence && !item.evidence) ? [index + 1] : []
				);
				if (next.items.length === 0 || open.length > 0) {
					return {
						completed: false,
						reason: mode.state?.evidence
							? 'Every item must be done with evidence before completing.'
							: 'Every item must be done before completing.',
						openItems: open,
					};
				}
			}
			if (next.status === 'blocked' && !note) throw new Error('A blocked state needs a note.');
			return writeState(sessionDirectory, { ...next, objective: next.objective });
		},
	});
}
