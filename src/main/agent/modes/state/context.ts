import type { ModeDefinition } from '../types';
import { readState } from './read';

const MARKS = { pending: ' ', in_progress: '~', done: 'x' } as const;

/** State text is written by the model, so `<` is escaped before it reaches the system prompt. */
export function stateContext(
	sessionDirectory: string,
	modes: readonly ModeDefinition[],
	activeIds: readonly string[],
	since: number
): string {
	const safe = (value: string): string => value.replaceAll('<', '&lt;');
	return modes
		.map((mode) => {
			const state = readState(sessionDirectory, mode.id);
			const rule = mode.state?.evidence
				? 'Completing requires every item done with evidence from tool output.'
				: 'Completing requires every item done.';
			if (!state) {
				return `<mode_state mode="${mode.id}" status="none">\nNo state yet. Call update_mode_state with the objective and items before working. ${rule}\n</mode_state>`;
			}
			const items = state.items
				.map(
					(item, index) =>
						`- [${MARKS[item.status]}] ${index + 1}. ${safe(item.text)}${item.evidence ? ` (evidence: ${safe(item.evidence)})` : ''}`
				)
				.join('\n');
			return [
				`<mode_state mode="${mode.id}" status="${state.status}">`,
				`Objective: ${safe(state.objective)}`,
				items,
				state.note ? `Note: ${safe(state.note)}` : '',
				activeIds.includes(mode.id) && state.updatedAt < since
					? `This state is from an earlier request. For a new objective, call update_mode_state with the new objective and items before working. ${rule}`
					: state.status === 'active'
						? `Keep this state current with update_mode_state as you make progress. ${rule}`
						: '',
				'</mode_state>',
			]
				.filter(Boolean)
				.join('\n');
		})
		.join('\n\n');
}
