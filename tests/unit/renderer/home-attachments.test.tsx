import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AgentPromptInputCapabilities } from '../../../src/shared/agent_types';
import Page from '../../../src/renderer/src/pages/home/Page';
import { validatePromptAttachments } from '../../../src/renderer/src/pages/home/attachments/validation';
import type { PromptAttachment } from '../../../src/renderer/src/pages/home/attachments/types';

const handleSubmit = jest.fn();
const setInput = jest.fn();
const useSuggestion = jest.fn();
const clearReply = jest.fn();
let replyTo: { id: string; content: string } | null = null;
let modelCatalogChanged: (() => void) | undefined;

jest.mock('../../../src/renderer/src/pages/home/hooks', () => ({
	useHomeAgent: () => ({
		chatState: { messages: [{ id: 'agent-welcome', role: 'agent' }] },
		editUserMessage: jest.fn(),
		clearReply,
		replyTo,
		replyToMessage: jest.fn(),
		handleSubmit,
		historyLoading: false,
		input: '',
		inputRef: { current: null },
		isLoading: false,
		setInput,
		setInteractionMode: jest.fn(),
		switchToTyping: jest.fn(),
		useSuggestion,
	}),
	useRealtimeVoice: () => ({
		analyser: null,
		elapsedMs: 0,
		end: jest.fn().mockResolvedValue(undefined),
		errorMessage: null,
		isActive: false,
		isMuted: false,
		requiresConfiguration: false,
		setMuted: jest.fn(),
		start: jest.fn().mockResolvedValue(false),
		status: 'idle',
		stream: null,
	}),
	useRealtimeDictation: () => ({
		cancel: jest.fn().mockResolvedValue(undefined),
		elapsedMs: 0,
		errorMessage: null,
		finish: jest.fn().mockResolvedValue(undefined),
		isMuted: false,
		setMuted: jest.fn(),
		start: jest.fn().mockResolvedValue(false),
		status: 'idle',
		stream: null,
	}),
	useAudioRecorder: () => ({
		cancel: jest.fn().mockResolvedValue(undefined),
		elapsedMs: 0,
		errorMessage: null,
		isMuted: false,
		setMuted: jest.fn(),
		start: jest.fn().mockResolvedValue(false),
		status: 'idle',
		stop: jest.fn().mockResolvedValue(undefined),
		stream: null,
	}),
	useVoiceButtonMode: () => 'disabled',
}));

jest.mock('@/components/audio-player', () => ({
	AudioPlayer: () => <div />,
}));

jest.mock('@/components/app/base/page', () => ({
	PageContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	Split: ({ children }: { sidebar?: React.ReactNode; children?: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

jest.mock('@/components/ui/chat-container', () => ({
	ChatContainerRoot: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	ChatContainerContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	ChatContainerScrollAnchor: () => <div />,
}));

jest.mock('@/components/ui/prompt-input', () => ({
	PromptInputAction: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
	PromptInputActions: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	usePromptInput: () => ({ triggerFileUpload: jest.fn() }),
}));

jest.mock('@/components/ui/scroll-button', () => ({
	ScrollButton: () => <button type="button">Scroll</button>,
}));

jest.mock('../../../src/renderer/src/pages/home/components/AssistantMessage', () => ({
	AssistantMessage: () => <div />,
}));

jest.mock('../../../src/renderer/src/pages/home/components/UserMessage', () => ({
	UserMessage: () => <div />,
}));

jest.mock('@/components/prompt-editor', () => ({
	PromptEditor: ({
		value,
		onValueChange,
		header,
		leadingAction,
		actions,
		onFilesChange,
		filesAccept,
	}: {
		value: string;
		onValueChange: (value: string) => void;
		header?: React.ReactNode;
		leadingAction?: React.ReactNode;
		actions?: React.ReactNode;
		onFilesChange?: (files: File[]) => void;
		filesAccept?: string;
	}) => (
		<div>
			{header}
			<input
				aria-label="Attachment files"
				type="file"
				multiple
				accept={filesAccept}
				onChange={(event) => onFilesChange?.(Array.from(event.target.files ?? []))}
			/>
			<textarea value={value} onChange={(event) => onValueChange(event.target.value)} />
			{leadingAction}
			{actions}
		</div>
	),
}));

const textCapabilities: AgentPromptInputCapabilities = {
	rules: [],
	accept: '.txt,.md',
	limits: {
		maxFiles: 10,
		maxBinaryBytes: 20 * 1024 * 1024,
		maxBinaryTotalBytes: 50 * 1024 * 1024,
		maxTextBytes: 120_000,
		maxTextTotalBytes: 500_000,
	},
};

const imageCapabilities: AgentPromptInputCapabilities = {
	...textCapabilities,
	accept: '.txt,.png,image/png',
	rules: [{ kind: 'image', mimeTypes: ['image/png'], extensions: ['.png'] }],
};

function renderPage(getCapabilities: jest.Mock): void {
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: { getPromptInputCapabilities: getCapabilities },
	});
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: {
			onModelsChanged: (callback: () => void) => {
				modelCatalogChanged = callback;
				return jest.fn();
			},
		},
	});
	render(
		<MemoryRouter>
			<Page />
		</MemoryRouter>
	);
}

describe('Home prompt attachments', () => {
	beforeEach(() => {
		handleSubmit.mockResolvedValue(true);
		useSuggestion.mockClear();
		modelCatalogChanged = undefined;
		replyTo = null;
	});

	it('shows the full empty-state prompt set and fills a selected suggestion', async () => {
		const getCapabilities = jest.fn().mockResolvedValue(textCapabilities);
		renderPage(getCapabilities);
		await waitFor(() =>
			expect(screen.getByLabelText('Attachment files')).toHaveAttribute(
				'accept',
				textCapabilities.accept
			)
		);

		expect(screen.getByText('What can I do for you?')).toBeInTheDocument();
		for (const label of [
			'Schedule a task',
			'Create a sound',
			'Create an image',
			'Create a video',
			'Create music',
			'Contact an agent',
			'Summarize a document',
			'Plan a trip',
		]) {
			expect(screen.getByText(label)).toBeInTheDocument();
		}

		fireEvent.click(screen.getByText('Plan a trip'));
		expect(useSuggestion).toHaveBeenCalledWith(
			'Plan a five-day trip to Rome with food, art, and quiet neighborhoods.'
		);
	});

	it('keeps local text available on text-only models and disables the picker on resolution failure', async () => {
		const getCapabilities = jest.fn().mockResolvedValueOnce(textCapabilities);
		renderPage(getCapabilities);
		await waitFor(() =>
			expect(screen.getByLabelText('Attachment files')).toHaveAttribute(
				'accept',
				textCapabilities.accept
			)
		);
		expect(screen.getByRole('button', { name: 'Add attachment' })).toBeEnabled();

		getCapabilities.mockRejectedValueOnce(new Error('catalog unavailable'));
		modelCatalogChanged?.();
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Add attachment' })).toBeDisabled()
		);
	});

	it('keeps a queued file visible and blocks Send when a model change makes it incompatible', async () => {
		const getCapabilities = jest
			.fn()
			.mockResolvedValueOnce(imageCapabilities)
			.mockResolvedValueOnce(textCapabilities);
		renderPage(getCapabilities);
		const picker = await screen.findByLabelText('Attachment files');
		await waitFor(() => expect(picker).toHaveAttribute('accept', imageCapabilities.accept));
		fireEvent.change(picker, {
			target: { files: [new File(['png'], 'diagram.png', { type: 'image/png' })] },
		});
		expect(screen.getByText('diagram.png')).toBeInTheDocument();

		modelCatalogChanged?.();
		expect(
			await screen.findByText('This file type is not supported by the selected model.')
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
	});

	it('clears submitted files immediately while the captured request continues', async () => {
		const getCapabilities = jest.fn().mockResolvedValue(imageCapabilities);
		let resolveSubmit = (_accepted: boolean): void => {};
		handleSubmit.mockReturnValueOnce(
			new Promise<boolean>((resolve) => {
				resolveSubmit = resolve;
			})
		);
		renderPage(getCapabilities);
		const picker = await screen.findByLabelText('Attachment files');
		await waitFor(() => expect(picker).toHaveAttribute('accept', imageCapabilities.accept));
		const file = new File(['png'], 'diagram.png', { type: 'image/png' });
		fireEvent.change(picker, { target: { files: [file] } });
		await screen.findByText('diagram.png');

		fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
		await waitFor(() => expect(handleSubmit).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(screen.queryByText('diagram.png')).not.toBeInTheDocument());
		expect(handleSubmit).toHaveBeenCalledWith([file], undefined);
		resolveSubmit(false);
	});

	it('validates type, individual size, totals, and count from file metadata', () => {
		const limits = {
			...imageCapabilities,
			limits: {
				...imageCapabilities.limits,
				maxFiles: 2,
				maxBinaryBytes: 4,
				maxBinaryTotalBytes: 6,
			},
		};
		const files = [
			new File(['12345'], 'large.png', { type: 'image/png' }),
			new File(['12'], 'notes.pdf', { type: 'application/pdf' }),
			new File(['1'], 'extra.png', { type: 'image/png' }),
		];
		const attachments: PromptAttachment[] = files.map((file, index) => ({
			id: String(index),
			kind: 'file',
			file,
		}));
		const result = validatePromptAttachments(attachments, limits);
		expect(result[0].error).toMatch(/4 bytes or smaller/);
		expect(result[1].error).toMatch(/not supported/);
		expect(result[2].error).toMatch(/maximum of 2/);
	});

	it('shows reply context alongside attachments and lets the user cancel it', async () => {
		replyTo = { id: 'assistant-one', content: 'The answer being discussed.' };
		renderPage(jest.fn().mockResolvedValue(imageCapabilities));
		const picker = await screen.findByLabelText('Attachment files');
		await waitFor(() => expect(picker).toHaveAttribute('accept', imageCapabilities.accept));
		fireEvent.change(picker, {
			target: { files: [new File(['png'], 'diagram.png', { type: 'image/png' })] },
		});

		expect(screen.getByRole('group', { name: 'Replying to Kucedr' })).toHaveTextContent(
			'The answer being discussed.'
		);
		expect(screen.getByText('diagram.png')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Cancel reply' }));
		expect(clearReply).toHaveBeenCalledTimes(1);
		expect(screen.getByText('diagram.png')).toBeInTheDocument();
	});
});
