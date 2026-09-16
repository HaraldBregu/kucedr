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

it('shows a generated image picker and switches its selected image', () => {
	render(
		<AssistantMessage
			message={message(
				'Here are two choices:\n![first](/tmp/first.png)\n![second](/tmp/second.png)',
				[
					{
						toolCallId: 'images-1',
						type: 'create_image',
						state: 'output-available',
						output: {
							images: [
								{ path: '/tmp/first.png', mimeType: 'image/png' },
								{ path: '/tmp/second.png', mimeType: 'image/png' },
							],
						},
					},
				]
			)}
		/>
	);

	expect(screen.getByRole('img', { name: 'Generated image 1 of 2' })).toHaveAttribute(
		'src',
		'local-resource://file/tmp/first.png'
	);
	expect(screen.getByRole('img', { name: 'Generated image 1 of 2' })).toHaveClass('object-cover');
	expect(screen.getByLabelText('Generated images')).toHaveClass('grid-cols-[minmax(0,1fr)_4rem]');
	expect(screen.getByLabelText('Choose generated image')).toHaveClass('overflow-y-auto');
	fireEvent.click(screen.getByRole('button', { name: 'Show generated image 2 of 2' }));
	expect(screen.getByRole('img', { name: 'Generated image 2 of 2' })).toHaveAttribute(
		'src',
		'local-resource://file/tmp/second.png'
	);
	expect(screen.getByRole('button', { name: 'Show generated image 2 of 2' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	expect(screen.getByRole('button', { name: 'Show generated image 2 of 2' })).not.toHaveClass(
		'border-primary'
	);
	expect(screen.getByRole('button', { name: 'Show generated image 1 of 2' })).toHaveClass(
		'brightness-50'
	);
	expect(screen.getByText(/Here are two choices/)).toBeInTheDocument();
});

it('groups images from separate image tool calls into one picker', () => {
	render(
		<AssistantMessage
			message={message('', [
				{
					toolCallId: 'image-1',
					type: 'create_image',
					state: 'output-available',
					output: { path: '/tmp/first.png' },
				},
				{
					toolCallId: 'image-2',
					type: 'create_image',
					state: 'output-available',
					output: { path: '/tmp/second.png' },
				},
			])}
		/>
	);

	expect(screen.getByRole('img', { name: 'Generated image 1 of 2' })).toHaveAttribute(
		'src',
		'local-resource://file/tmp/first.png'
	);
	expect(screen.getByRole('button', { name: 'Show generated image 1 of 2' })).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Show generated image 2 of 2' })).toBeInTheDocument();
});

it('shows image pickers from restored tool output', () => {
	render(
		<AssistantMessage
			message={message('', [
				{
					toolCallId: 'images-1',
					type: 'create_image',
					state: 'output-available',
					output: JSON.stringify({
						images: [
							{ path: '/tmp/first.png', mimeType: 'image/png' },
							{ path: '/tmp/second.png', mimeType: 'image/png' },
						],
					}),
				},
			])}
		/>
	);

	expect(screen.getByRole('img', { name: 'Generated image 1 of 2' })).toHaveAttribute(
		'src',
		'local-resource://file/tmp/first.png'
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
