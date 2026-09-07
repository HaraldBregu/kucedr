import { fireEvent, render, screen } from '@testing-library/react';
import { AssistantMessage } from '../../../src/renderer/src/pages/home/components/AssistantMessage';
import type { AgentMessage } from '../../../src/renderer/src/pages/home/context';

jest.mock('react-markdown', () => ({ defaultUrlTransform: (url: string) => url }));
jest.mock('@/components/prompt-kit/markdown', () => ({
	Markdown: ({
		children,
		components,
	}: {
		children: string;
		components: { img: (props: { src: string; alt: string }) => React.ReactNode };
	}) => {
		const image = /!\[([^\]]*)\]\(([^)]+)\)/.exec(children);
		return image ? components.img({ alt: image[1], src: image[2] }) : <div>{children}</div>;
	},
}));
jest.mock('@/components/audio-player', () => ({
	AudioPlayer: ({ src }: { src: string }) => <div data-testid="generated-audio" data-src={src} />,
}));
jest.mock('@/components/video-player', () => ({
	VideoPlayer: ({ src }: { src: string }) => <div data-testid="generated-video" data-src={src} />,
}));
jest.mock('@/pages/home/hooks', () => ({
	useReadMessageAloud: () => ({
		speak: jest.fn(),
		isSpeaking: false,
		errorMessage: null,
		clearError: jest.fn(),
	}),
}));

function message(content: string, tools: AgentMessage['tools'] = []): AgentMessage {
	return {
		id: 'assistant-1',
		role: 'agent',
		type: 'agent',
		content,
		state: 'completed',
		tools,
	};
}

it('does not load an arbitrary absolute image path from assistant Markdown', () => {
	render(<AssistantMessage message={message('![private](/Users/alice/private.png)')} />);

	expect(screen.getByRole('img', { name: 'private' })).not.toHaveAttribute('src');
});

it('encodes reserved pathname characters in generated media URLs', () => {
	render(
		<AssistantMessage
			message={message('', [
				{
					toolCallId: 'image-1',
					type: 'create_image',
					state: 'output-available',
					output: { path: '/tmp/generated#draft?.png' },
				},
			])}
		/>
	);

	expect(screen.getByRole('img', { name: 'Generated image' })).toHaveAttribute(
		'src',
		'local-resource://file/tmp/generated%23draft%3F.png'
	);
});

it('expands and collapses long assistant content', () => {
	const { container } = render(
		<AssistantMessage message={message('x'.repeat(700))} collapseLongContent />
	);
	const content = container.querySelector('[data-slot="assistant-message-content"]');

	expect(content).toHaveClass('max-h-40', 'overflow-hidden');
	fireEvent.click(screen.getByRole('button', { name: 'More' }));
	expect(content).not.toHaveClass('max-h-40', 'overflow-hidden');
	expect(screen.getByRole('button', { name: 'Less' })).toHaveAttribute('aria-expanded', 'true');
});

it('replies to the selected assistant message', () => {
	const onReply = jest.fn();
	render(<AssistantMessage message={message('  The selected answer.  ')} onReply={onReply} />);
	fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
	expect(onReply).toHaveBeenCalledWith({ id: 'assistant-1', content: 'The selected answer.' });
});

it('uses the displayed plan content when replying to a plan', () => {
	const onReply = jest.fn();
	render(
		<AssistantMessage
			message={message('<proposed_plan>\nThe plan to discuss.\n</proposed_plan>')}
			onReply={onReply}
		/>
	);
	fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
	expect(onReply).toHaveBeenCalledWith({ id: 'assistant-1', content: 'The plan to discuss.' });
});
