import { render } from '@testing-library/react';
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
	const transcript = (
		<Messages
			messages={messages}
			isLoading={false}
			voiceMode={false}
			onEdit={onEdit}
			onReply={onReply}
			onImplement={onImplement}
		/>
	);
	const { rerender } = render(<div data-prompt="">{transcript}</div>);
	renderAssistant.mockClear();
	rerender(<div data-prompt="new draft">{transcript}</div>);
	expect(renderAssistant).not.toHaveBeenCalled();
});
