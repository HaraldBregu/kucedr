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
			'Create or update the tracked state of an active mode: its objective, its ordered items with their status and evidence, and the overall status. Items replace the previous list. Without a status the previous one is kept; a new objective starts an active state.',
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
			const saved = readState(sessionDirectory, id);
			const previous = objective && objective !== saved?.objective ? undefined : saved;
			const nextObjective = objective ?? previous?.objective;
			if (!nextObjective) throw new Error('A new mode state needs an objective.');
			const nextItems = items ?? previous?.items ?? [];
			const open = nextItems.flatMap((item, index) =>
				item.status !== 'done' || (mode.state?.evidence && !item.evidence) ? [index + 1] : []
			);
			const done = nextItems.length > 0 && open.length === 0;
			const requested = status ?? previous?.status ?? 'active';
			const nextStatus =
				requested === 'completed' && !done
					? 'active'
					: requested === 'active' && done && !mode.state?.continue
						? 'completed'
						: requested;
			const nextNote = note || (previous?.status === nextStatus ? previous.note : undefined);
			if (nextStatus === 'blocked' && !nextNote) throw new Error('A blocked state needs a note.');
			const state = writeState(sessionDirectory, {
				mode: id,
				status: nextStatus,
				objective: nextObjective,
				items: nextItems,
				...(nextNote ? { note: nextNote } : {}),
				updatedAt: Date.now(),
			});
			if (requested === 'completed' && !done) {
				throw new Error(
					nextItems.length === 0
						? 'Not completed: the state needs at least one item.'
						: `Not completed: items ${open.join(', ')} must be done${mode.state?.evidence ? ' with evidence' : ''}. The items were saved.`
				);
			}
			return state;
		},
	});
}
