import { chatAssets } from '../../../src/renderer/src/pages/home/components/assets';
import type { AgentMessage } from '../../../src/renderer/src/pages/home/context/state';

it('collects confirmed media and written files, deduplicating paths at their latest response', () => {
	const messages: AgentMessage[] = [
		{
			id: 'first', role: 'agent', type: 'agent', content: '', state: 'completed',
			tools: [
				{ toolCallId: 'image', type: 'create_image', state: 'output-available', output: { images: [{ path: '/image.png' }] } },
				{ toolCallId: 'write', type: 'write', state: 'output-available', output: JSON.stringify({ path: '/overview.md' }) },
			],
		},
		{
			id: 'second', role: 'agent', type: 'agent', content: '', state: 'completed',
			tools: [{ toolCallId: 'rewrite', type: 'write', state: 'output-available', output: { path: '/overview.md' } }],
		},
	];
	expect(chatAssets(messages)).toEqual([
		{ path: '/image.png', messageId: 'first' },
		{ path: '/overview.md', messageId: 'second' },
	]);
});

it('does not treat reads, failed writes, pending generation, or malformed output as assets', () => {
	expect(chatAssets([{
		id: 'response', role: 'agent', type: 'agent', content: '', state: 'completed',
		tools: [
			{ toolCallId: 'read', type: 'read', state: 'output-available', output: { path: '/source.md' } },
			{ toolCallId: 'failed', type: 'write', state: 'output-error', output: { path: '/failed.md' } },
			{ toolCallId: 'pending', type: 'create_image', state: 'input-available', output: { path: '/pending.png' } },
			{ toolCallId: 'invalid', type: 'write', state: 'output-available', output: 'invalid JSON' },
		],
	}])).toEqual([]);
});
