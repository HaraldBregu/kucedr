import en from '../../../resources/i18n/en/main.json';
import italian from '../../../resources/i18n/it/main.json';
import { statusLabel } from '../../../src/renderer/src/pages/home/components/status';
import type { AgentMessage } from '../../../src/renderer/src/pages/home/context';

function selectionMessage(state: 'selecting' | 'selected'): AgentMessage {
	return {
		id: 'selection',
		role: 'agent',
		type: 'agent',
		content: '',
		state: 'thinking',
		tools: [],
		toolSelection: { state, names: ['Read', 'Edit', 'Gmail', 'Calendar'] },
	};
}

it('formats compact English and Italian tool-selection statuses with overflow', () => {
	expect(
		statusLabel(selectionMessage('selecting'), {
			selecting: en.chat.toolSelection.selecting,
			selected: (names) => en.chat.toolSelection.selected.replace('{{tools}}', names),
		})
	).toBe('Selecting tools…');
	expect(
		statusLabel(selectionMessage('selected'), {
			selecting: italian.chat.toolSelection.selecting,
			selected: (names) => italian.chat.toolSelection.selected.replace('{{tools}}', names),
		})
	).toBe('Selezionati: Read, Edit, Gmail +1');
});
