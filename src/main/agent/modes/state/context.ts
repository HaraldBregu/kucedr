import type { ModeDefinition } from '../types';
import { readState } from './read';

const MARKS = { pending: ' ', in_progress: '~', done: 'x' } as const;

export function stateContext(sessionDirectory: string, modes: readonly ModeDefinition[]): string {
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
						`- [${MARKS[item.status]}] ${index + 1}. ${item.text}${item.evidence ? ` (evidence: ${item.evidence})` : ''}`
				)
				.join('\n');
			return [
				`<mode_state mode="${mode.id}" status="${state.status}">`,
				`Objective: ${state.objective}`,
				items,
				state.note ? `Note: ${state.note}` : '',
				state.status === 'active'
					? `Keep this state current with update_mode_state as you make progress. ${rule}`
					: '',
				'</mode_state>',
			]
				.filter(Boolean)
				.join('\n');
		})
		.join('\n\n');
}
