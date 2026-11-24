import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agentChatReducer, historyToChatMessages } from '../../../src/renderer/src/pages/home/context/reducer';
import { Messages } from '../../../src/renderer/src/pages/home/Messages';
import { welcomeMessage } from '../../../src/renderer/src/pages/home/context';

const renderAssistant = jest.fn();

jest.mock('../../../src/renderer/src/pages/home/components/AssistantMessage', () => ({
	AssistantMessage: (props: { message: { id: string } }) => {
		renderAssistant(props.message.id);
		return <div>{props.message.id}</div>;
	},
}));

jest.mock('../../../src/renderer/src/pages/home/components/UserMessage', () => ({
	UserMessage: () => <div />,
}));

jest.mock('@/components/prompt-kit/markdown', () => ({
	Markdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

it('keeps existing messages mounted while the surrounding prompt changes', () => {
	const messages = [{ ...welcomeMessage, id: 'response', state: 'completed' as const }];
	const onEdit = jest.fn();
	const onReply = jest.fn();
	const onImplement = jest.fn();
	const { rerender } = render(
		<div data-prompt="">
			<Messages
				messages={messages}
				isLoading={false}
				voiceMode={false}
				onEdit={onEdit}
				onReply={onReply}
				onImplement={onImplement}
			/>
		</div>
	);
	renderAssistant.mockClear();
	rerender(
		<div data-prompt="new draft">
			<Messages
				messages={messages}
				isLoading={false}
				voiceMode={false}
				onEdit={onEdit}
				onReply={onReply}
				onImplement={onImplement}
			/>
		</div>
	);
	expect(renderAssistant).not.toHaveBeenCalled();
});

it('keeps the automatic summary anchored to the same user turn live and after reload', async () => {
	const history = [
		{ role: 'user' as const, content: 'Original question' },
		{ role: 'assistant' as const, content: 'Original reply' },
		{ role: 'user' as const, content: 'Retained question' },
	];
	const summary = 'Summary of the earlier exchange';
	const state = agentChatReducer({ messages: historyToChatMessages(history) }, {
		type: 'apply_response_event',
		event: { type: 'history_compacted', userIndex: 1, summary, agentId: 'main', runId: 'active' },
		receivedAtMs: 100,
	});
	const restored = historyToChatMessages([history[0], history[1], { ...history[2], compaction: { summary } }]);
	expect(state.messages.slice(0, 3)).toEqual(restored);
	expect(restored[0]).toMatchObject({ content: 'Original question' });
	expect(restored[2]).toMatchObject({ content: 'Retained question', compaction: { summary } });
	render(<Messages messages={restored} isLoading={false} voiceMode={false} onEdit={jest.fn()}
		onReply={jest.fn()} onRegenerate={jest.fn()} onAction={jest.fn()} modes={[]} />);
	const disclosure = screen.getByText('settings.chatHistory.automaticallySummarized');
	expect(disclosure.closest('details')).not.toHaveAttribute('open');
	await userEvent.setup().click(disclosure);
	expect(disclosure.closest('details')).toHaveAttribute('open');
	expect(screen.getByText(summary)).toBeVisible();
});
