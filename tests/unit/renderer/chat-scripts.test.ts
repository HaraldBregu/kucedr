import { chatScripts } from '../../../src/renderer/src/pages/home/components/scripts';
import type { AgentMessage } from '../../../src/renderer/src/pages/home/context/state';

it('lists each successful script output with its title or name and source response', () => {
	const message: AgentMessage = {
		id: 'response', role: 'agent', type: 'agent', content: '', state: 'completed',
		tools: [
			{ toolCallId: 'first', type: 'run_script', state: 'output-available', input: { name: 'chart', input: { title: 'Revenue' } } },
			{ toolCallId: 'second', type: 'run_plugin_script', state: 'output-available', input: { name: 'chart', input: { title: '' } } },
			{ toolCallId: 'failed', type: 'run_script', state: 'output-error', input: { name: 'draw' } },
			{ toolCallId: 'pending', type: 'run_script', state: 'input-available', input: { name: 'draw' } },
			{ toolCallId: 'load', type: 'load_script', state: 'output-available', input: { name: 'draw' } },
			{ toolCallId: 'invalid', type: 'run_script', state: 'output-available' },
		],
	};
	expect(chatScripts([message])).toEqual([
		{ id: 'first', label: 'Revenue', messageId: 'response' },
		{ id: 'second', label: 'chart', messageId: 'response' },
	]);
});
