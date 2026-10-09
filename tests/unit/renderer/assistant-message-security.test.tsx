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

it('shows a lightbulb beside the active Thinking label', () => {
	const thinking = { ...message(''), state: 'thinking' as const };
	const { container } = render(<AssistantMessage message={thinking} isStreaming />);

	expect(screen.getByText('Thinking')).toBeInTheDocument();
	expect(container.querySelector('.lucide-lightbulb')).toBeInTheDocument();
});

it('shows a failed MCP tool before its authorization request', () => {
	const { container } = render(
		<AssistantMessage
			message={{
				...message('', [
					{
						toolCallId: 'gmail-call',
						type: 'mcp__gmail__search',
						state: 'output-error',
						displayName: 'Search Gmail',
						output: { status: 'authorization_required' },
					},
					{
						toolCallId: 'gmail-auth',
						type: 'request_mcp_authorization',
						state: 'input-available',
						input: { serverId: 'gmail', toolName: 'Search Gmail' },
					},
				]),
				pendingUserInput: {
					requestId: 'request',
					runId: 'run',
					toolCallId: 'gmail-auth',
					inputFingerprint: 'fingerprint',
					expiresAt: new Date(Date.now() + 60_000).toISOString(),
					questions: [
						{ id: 'mcp-authorization', header: 'MCP', question: 'Authorize Gmail?', options: [] },
					],
				},
			}}
		/>
	);

	const failedCall = screen.getByText('Search Gmail');
	const authorization = screen.getByText('Authorize Gmail');
	expect(failedCall.compareDocumentPosition(authorization) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	expect(container.querySelector('[aria-label="Failed"]')).toBeInTheDocument();
	expect(screen.getByText('After authorization, Search Gmail will be retried automatically.')).toBeInTheDocument();
});

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
	expect(screen.getByRole('img', { name: 'Generated image 1 of 2' })).toHaveClass('object-contain');
	expect(screen.getByLabelText('Generated images')).toHaveClass('flex');
	expect(screen.getByLabelText('Choose generated image')).toHaveClass('flex-col');
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

it.each(['live', 'restored'] as const)(
	'renders library media and explicitly requested paths from %s tool outputs',
	(mode) => {
		const locations = ['/Users/test/.kucedr/library', '/Users/test/Chosen #à'];
		const tools: AgentMessage['tools'] = locations.flatMap((directory, index) =>
			['create_image', 'create_video', 'create_sound'].map((type) => {
				const extension = type === 'create_image' ? 'png' : type === 'create_video' ? 'mp4' : 'wav';
				const output = { path: `${directory}/media ${index}.${extension}` };
				return {
					toolCallId: `${type}-${index}`,
					type,
					state: 'output-available' as const,
					output: mode === 'restored' ? JSON.stringify(output) : output,
				};
			})
		);
		render(<AssistantMessage message={message('', tools)} />);
		expect(screen.getByRole('img', { name: 'Generated image 1 of 2' })).toHaveAttribute(
			'src',
			'local-resource://file/Users/test/.kucedr/library/media%200.png'
		);
		fireEvent.click(screen.getByRole('button', { name: 'Show generated image 2 of 2' }));
		expect(screen.getByRole('img', { name: 'Generated image 2 of 2' })).toHaveAttribute(
			'src',
			'local-resource://file/Users/test/Chosen%20%23%C3%A0/media%201.png'
		);
		for (const [testId, extension] of [['generated-video', 'mp4'], ['generated-audio', 'wav']]) {
			const players = screen.getAllByTestId(testId);
			expect(players[0]).toHaveAttribute(
				'data-src',
				`local-resource://file/Users/test/.kucedr/library/media%200.${extension}`
			);
			expect(players[1]).toHaveAttribute(
				'data-src',
				`local-resource://file/Users/test/Chosen%20%23%C3%A0/media%201.${extension}`
			);
		}
	}
);

it.each([
	'microphone_recorder', 'microphone_recorder_status', 'microphone_recorder_stop',
	'camera_recorder', 'camera_recorder_status', 'camera_recorder_stop',
	'screen_recorder', 'screen_recorder_status', 'screen_recorder_stop',
])('renders completed %s output with the correct WebM player', (type) => {
	render(<AssistantMessage message={message('', [{
		toolCallId: 'recording', type, state: 'output-available',
		output: JSON.stringify({ path: '/Users/test/.kucedr/library/capture.webm', status: 'completed' }),
	}])} />);
	expect(screen.getByTestId(type.startsWith('microphone') ? 'generated-audio' : 'generated-video'))
		.toHaveAttribute('data-src', 'local-resource://file/Users/test/.kucedr/library/capture.webm');
});

it('does not load unfinished, cancelled or failed recordings', () => {
	const tools: AgentMessage['tools'] = ['selecting', 'recording', 'stopping', 'saving', 'cancelled', 'error']
		.map((status) => ({
			toolCallId: status, type: 'microphone_recorder_status', state: 'output-available',
			output: { path: `/Users/test/.kucedr/library/${status}.webm`, status },
		}));
	tools.push({
		toolCallId: 'failed', type: 'camera_recorder_status', state: 'output-error',
		output: { path: '/Users/test/.kucedr/library/failed.webm', status: 'completed' },
	});
	render(<AssistantMessage message={message('', tools)} />);
	expect(screen.queryByTestId('generated-audio')).not.toBeInTheDocument();
	expect(screen.queryByTestId('generated-video')).not.toBeInTheDocument();
});

it('shows one player when recorder status and stop return the same completed file', () => {
	render(<AssistantMessage message={message('', ['microphone_recorder_status', 'microphone_recorder_stop']
		.map((type) => ({
			toolCallId: type, type, state: 'output-available',
			output: { path: '/Users/test/.kucedr/library/capture.webm', status: 'completed' },
		})))} />);
	expect(screen.getAllByTestId('generated-audio')).toHaveLength(1);
});

it('renders browser screenshots while keeping PDFs and unrelated tool paths out of the gallery', () => {
	render(<AssistantMessage message={message('', [
		{
			toolCallId: 'screenshot', type: 'use_web_browser', state: 'output-available',
			input: { action: 'screenshot' },
			output: JSON.stringify({ targetId: 't1', path: '/Users/test/.kucedr/library/browser.png' }),
		},
		{
			toolCallId: 'pdf', type: 'use_web_browser', state: 'output-available',
			input: { action: 'pdf' }, output: { path: '/Users/test/.kucedr/library/browser.pdf' },
		},
		{
			toolCallId: 'other', type: 'read_file', state: 'output-available',
			output: { path: '/Users/test/private.png' },
		},
	])} />);
	expect(screen.getAllByRole('img')).toHaveLength(1);
	expect(screen.getByRole('img', { name: 'Generated image' })).toHaveAttribute(
		'src', 'local-resource://file/Users/test/.kucedr/library/browser.png'
	);
});

it('renders embedded microphone WebM as audio', () => {
	render(<AssistantMessage message={message('![recording](/Users/test/.kucedr/library/capture.webm)', [{
		toolCallId: 'recording', type: 'microphone_recorder_status', state: 'output-available',
		output: { path: '/Users/test/.kucedr/library/capture.webm', status: 'completed' },
	}])} />);
	expect(screen.getAllByTestId('generated-audio')).toHaveLength(1);
	expect(screen.queryByTestId('generated-video')).not.toBeInTheDocument();
});

it('shows long assistant content in full without an expand control', () => {
	const { container } = render(
		<AssistantMessage message={message('x'.repeat(700))} />
	);
	const content = container.querySelector('[data-slot="assistant-message-content"]');

	expect(content).not.toHaveClass('max-h-40', 'overflow-hidden');
	expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'Less' })).not.toBeInTheDocument();
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
