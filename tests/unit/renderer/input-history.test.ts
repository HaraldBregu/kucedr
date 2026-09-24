import type { AgentHistoryMessage } from '../../../src/shared/agent_types';
import { historyToChatMessages } from '../../../src/renderer/src/pages/home/context';

it('restores a persisted conversation summary as its own visible message', () => {
	const messages = historyToChatMessages([{ role: 'summary', content: 'Keep the API private.' }]);
	expect(messages).toEqual([
		{ id: 'summary-history-0', role: 'summary', type: 'summary', content: 'Keep the API private.' },
	]);
});

it('restores an unresolved structured input call as interrupted', () => {
	const history: AgentHistoryMessage[] = [
		{
			role: 'assistant',
			content: '',
			contentBlocks: [
				{
					type: 'tool_use',
					toolUseId: 'question',
					toolName: 'ask',
					toolArgs: {
						questions: [
							{
								id: 'scope',
								header: 'Scope',
								question: 'Which scope?',
								options: [],
							},
						],
					},
				},
			],
		},
	];
	const message = historyToChatMessages(history)[0];
	expect(message?.role).toBe('agent');
	if (!message || message.role !== 'agent') throw new Error('Expected restored assistant.');
	expect(message.tools[0]).toMatchObject({
		type: 'ask',
		state: 'output-error',
		output: { status: 'interrupted', answers: [] },
	});
});

it('restores an image tool without a result as stopped', () => {
	const history: AgentHistoryMessage[] = [
		{ role: 'user', content: 'Create an image.' },
		{
			role: 'assistant',
			content: '',
			contentBlocks: [
				{
					type: 'tool_use',
					toolUseId: 'image',
					toolName: 'create_image',
					toolArgs: { prompt: 'A mountain' },
				},
			],
		},
		{ role: 'user', content: 'Continue without it.' },
		{ role: 'assistant', content: 'Continuing.' },
	];
	const message = historyToChatMessages(history)[1];
	expect(message?.role).toBe('agent');
	if (!message || message.role !== 'agent') throw new Error('Expected restored assistant.');
	expect(message.tools[0]).toMatchObject({
		type: 'create_image',
		state: 'output-error',
		status: 'error',
	});
});

it('restores attachment-only user messages from persisted history', () => {
	const history: AgentHistoryMessage[] = [
		{
			role: 'user',
			content: '',
			contentBlocks: [
				{
					type: 'attachment',
					kind: 'document',
					name: 'brief.pdf',
					mimeType: 'application/pdf',
					bytes: 1234,
				},
			],
		},
	];
	const message = historyToChatMessages(history)[0];
	expect(message).toEqual({
		id: 'user-history-0',
		role: 'user',
		type: 'user',
		content: '',
		attachments: [{
			type: 'attachment',
			kind: 'document',
			name: 'brief.pdf',
			mimeType: 'application/pdf',
			bytes: 1234,
		}],
	});
});
