import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { AssistantMessage } from '../../../src/renderer/src/pages/home/components/AssistantMessage';
import { Provider, historyToChatMessages } from '../../../src/renderer/src/pages/home/context';
import { useHomeAgentContext } from '../../../src/renderer/src/pages/home/context';
import { useRealtimeVoice } from '../../../src/renderer/src/pages/home/hooks/useRealtimeVoice';
import type { AgentHistoryMessage } from '../../../src/shared/agent_types';
import type { RealtimeVoiceEvent, RealtimeVoiceSession } from '../../../src/shared/realtime_voice';

jest.mock('react-markdown', () => ({ defaultUrlTransform: (url: string) => url }));
jest.mock('@/components/prompt-kit/markdown', () => ({
	Markdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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

jest.mock('@/lib/providers', () => ({
	modelsFor: (capability: string) =>
		capability === 'realtime-voice' ? [{ id: 'gpt-realtime-2.1', name: 'GPT Realtime' }] : [],
}));

const track = { enabled: true, stop: jest.fn() };
const mediaStream = {
	getTracks: () => [track],
	getAudioTracks: () => [track],
} as unknown as MediaStream;

let processor: {
	onaudioprocess: ((event: { inputBuffer: { getChannelData: () => Float32Array } }) => void) | null;
	connect: jest.Mock;
	disconnect: jest.Mock;
};
let playedSource: { stop: jest.Mock; onended: (() => void) | null };

class FakeAudioContext {
	readonly sampleRate = 48_000;
	readonly currentTime = 0;
	readonly destination = {} as AudioDestinationNode;
	createMediaStreamSource = jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn() }));
	createScriptProcessor = jest.fn(() => {
		processor = { onaudioprocess: null, connect: jest.fn(), disconnect: jest.fn() };
		return processor;
	});
	createAnalyser = jest.fn(() => ({
		fftSize: 512,
		smoothingTimeConstant: 0,
		connect: jest.fn(),
		disconnect: jest.fn(),
		getByteTimeDomainData: jest.fn(),
	}));
	createBuffer = jest.fn((_channels: number, length: number, sampleRate: number) => ({
		duration: length / sampleRate,
		getChannelData: () => new Float32Array(length),
	}));
	createBufferSource = jest.fn(() => {
		playedSource = { stop: jest.fn(), onended: null };
		return {
			...playedSource,
			buffer: null,
			connect: jest.fn(),
			start: jest.fn(),
		};
	});
	resume = jest.fn().mockResolvedValue(undefined);
	close = jest.fn().mockResolvedValue(undefined);
}

const session: RealtimeVoiceSession = {
	id: 'voice-session',
	providerId: 'openai',
	modelId: 'gpt-realtime-2.1',
	input: { format: 'pcm16', sampleRate: 24_000, channels: 1 },
	output: { format: 'pcm16', sampleRate: 24_000, channels: 1 },
};

const mediaTools = [
	{
		toolCallId: 'image-call',
		toolName: 'create_image',
		generatedPath: '/tmp/generated-image.png',
		restoredPath: '/tmp/restored-image.png',
	},
	{
		toolCallId: 'audio-call',
		toolName: 'create_sound',
		generatedPath: '/tmp/generated-audio.mp3',
		restoredPath: '/tmp/restored-audio.mp3',
	},
	{
		toolCallId: 'video-call',
		toolName: 'create_video',
		generatedPath: '/tmp/generated-video.mp4',
		restoredPath: '/tmp/restored-video.mp4',
	},
] as const;

const api = {
	startSession: jest.fn(),
	appendAudio: jest.fn(),
	interruptSession: jest.fn(),
	stopSession: jest.fn(),
	onSessionEvent: jest.fn(),
	getOptions: jest.fn(),
	setOptions: jest.fn(),
	getProviderId: jest.fn(),
	setProviderId: jest.fn(),
	getModelId: jest.fn(),
	setModelId: jest.fn(),
};

function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
	return (
		<StrictMode>
			<Provider>{children}</Provider>
		</StrictMode>
	);
}

describe('useRealtimeVoice', () => {
	let emit: (event: RealtimeVoiceEvent) => void;

	beforeEach(() => {
		jest.clearAllMocks();
		track.enabled = true;
		Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
		Object.defineProperty(navigator, 'mediaDevices', {
			configurable: true,
			value: { getUserMedia: jest.fn().mockResolvedValue(mediaStream) },
		});
		api.appendAudio.mockResolvedValue(undefined);
		api.interruptSession.mockResolvedValue(undefined);
		api.stopSession.mockResolvedValue(undefined);
		api.onSessionEvent.mockImplementation((listener: (event: RealtimeVoiceEvent) => void) => {
			emit = listener;
			return jest.fn();
		});
		window.models = { realtimeVoice: api } as unknown as Window['models'];
		window.app = {
			getMicrophoneInputId: jest.fn().mockResolvedValue('default'),
			getMicrophonePermission: jest.fn().mockResolvedValue({
				enabled: true,
				systemStatus: 'granted',
				canRequest: false,
			}),
		} as unknown as Window['app'];
	});

	it('survives early start events, mutes capture, stops playback on barge-in, and tears down', async () => {
		let resolveStart!: (value: RealtimeVoiceSession) => void;
		api.startSession.mockReturnValue(
			new Promise<RealtimeVoiceSession>((resolve) => {
				resolveStart = resolve;
			})
		);
		const onClosed = jest.fn();
		const { result, unmount } = renderHook(
			() => useRealtimeVoice({ chatSessionId: 'chat-1', onClosed }),
			{ wrapper }
		);

		let startPromise!: Promise<boolean>;
		act(() => {
			startPromise = result.current.start();
		});
		await waitFor(() => expect(api.startSession).toHaveBeenCalledWith({ chatSessionId: 'chat-1' }));
		expect(result.current.status).toBe('connecting');

		act(() => emit({ type: 'state', sessionId: session.id, status: 'listening' }));
		await act(async () => {
			resolveStart(session);
			await startPromise;
		});
		expect(result.current.status).toBe('listening');

		act(() => {
			processor.onaudioprocess?.({
				inputBuffer: { getChannelData: () => new Float32Array([0.25, -0.25]) },
			});
		});
		await waitFor(() => expect(api.appendAudio).toHaveBeenCalledTimes(1));
		act(() => result.current.setMuted(true));
		expect(track.enabled).toBe(false);
		act(() => {
			processor.onaudioprocess?.({
				inputBuffer: { getChannelData: () => new Float32Array([0.5]) },
			});
		});
		expect(api.appendAudio).toHaveBeenCalledTimes(1);

		act(() => emit({ type: 'assistant_audio_delta', sessionId: session.id, audio: 'AAA=' }));
		act(() => emit({ type: 'input_speech_started', sessionId: session.id }));
		expect(playedSource.stop).toHaveBeenCalled();
		expect(api.interruptSession).not.toHaveBeenCalled();

		await act(async () => result.current.end());
		expect(api.stopSession).toHaveBeenCalledWith(session.id);
		expect(track.stop).toHaveBeenCalled();
		expect(onClosed).toHaveBeenCalled();
		unmount();
	});

	it('turns append failures into a terminal visible error', async () => {
		api.startSession.mockResolvedValue(session);
		api.appendAudio.mockRejectedValue(new Error('Audio transport failed.'));
		const onClosed = jest.fn();
		const { result } = renderHook(() => useRealtimeVoice({ chatSessionId: 'chat-1', onClosed }), {
			wrapper,
		});
		await act(async () => result.current.start());
		act(() => {
			processor.onaudioprocess?.({
				inputBuffer: { getChannelData: () => new Float32Array([0.25]) },
			});
		});
		await waitFor(() => expect(result.current.errorMessage).toBe('Audio transport failed.'));
		expect(result.current.status).toBe('error');
		expect(api.stopSession).toHaveBeenCalledWith(session.id);
		expect(onClosed).toHaveBeenCalled();
	});

	it('keeps a pending voice turn empty until the final user transcript arrives', async () => {
		api.startSession.mockResolvedValue(session);
		const { result } = renderHook(
			() => {
				const voice = useRealtimeVoice({ chatSessionId: 'chat-1', onClosed: jest.fn() });
				const { chatState } = useHomeAgentContext();
				return { voice, chatState };
			},
			{ wrapper }
		);
		await act(async () => result.current.voice.start());

		act(() => emit({ type: 'user_turn', sessionId: session.id, itemId: 'user-1' }));
		expect(result.current.chatState.messages.filter((message) => message.role === 'user')).toEqual([
			expect.objectContaining({ content: '' }),
		]);

		act(() =>
			emit({
				type: 'user_turn',
				sessionId: session.id,
				itemId: 'user-1',
				transcript: 'Show the message I sent.',
			})
		);
		expect(result.current.chatState.messages.filter((message) => message.role === 'user')).toEqual([
			expect.objectContaining({ content: 'Show the message I sent.' }),
		]);
	});

	it('renders realtime tool status and generated image, audio, and video results', async () => {
		api.startSession.mockResolvedValue(session);
		const { result } = renderHook(
			() => {
				const voice = useRealtimeVoice({ chatSessionId: 'chat-1', onClosed: jest.fn() });
				const { chatState } = useHomeAgentContext();
				return { voice, chatState };
			},
			{ wrapper }
		);
		await act(async () => result.current.voice.start());
		act(() => emit({ type: 'user_turn', sessionId: session.id, itemId: 'user-1' }));

		for (const { toolCallId, toolName } of mediaTools) {
			act(() =>
				emit({
					type: 'tool_call_start',
					sessionId: session.id,
					agentId: 'main',
					runId: session.id,
					iteration: 0,
					toolCallId,
					toolName,
					name: toolName,
					serviceKind: 'tool',
				})
			);
		}

		let message = result.current.chatState.messages.findLast(
			(candidate) => candidate.role === 'agent'
		);
		expect(message?.role).toBe('agent');
		if (!message || message.role !== 'agent')
			throw new Error('Expected a voice assistant message.');
		const view = render(<AssistantMessage message={message} />);
		expect(screen.getAllByLabelText('Running')).toHaveLength(3);

		for (const { toolCallId, toolName, generatedPath } of mediaTools) {
			const output = JSON.stringify({ path: generatedPath });
			act(() =>
				emit({
					type: 'tool_call_result',
					sessionId: session.id,
					agentId: 'main',
					runId: session.id,
					iteration: 0,
					toolCallId,
					toolName,
					input: { prompt: `Generate ${toolName}` },
					output,
					outputText: output,
					status: 'ok',
					durationMs: 120,
					name: toolName,
					serviceKind: 'tool',
				})
			);
		}

		message = result.current.chatState.messages.findLast((candidate) => candidate.role === 'agent');
		expect(message?.role).toBe('agent');
		if (!message || message.role !== 'agent')
			throw new Error('Expected a voice assistant message.');
		for (const { toolCallId, toolName } of mediaTools) {
			expect(message.tools).toContainEqual(
				expect.objectContaining({
					toolCallId,
					type: toolName,
					state: 'output-available',
					status: 'ok',
				})
			);
		}
		view.rerender(<AssistantMessage message={message} />);

		expect(screen.getAllByLabelText('Completed')).toHaveLength(3);
		expect(screen.getByRole('img', { name: 'Generated image' })).toHaveAttribute(
			'src',
			'local-resource://file/tmp/generated-image.png'
		);
		expect(screen.getByTestId('generated-audio')).toHaveAttribute(
			'data-src',
			'local-resource://file/tmp/generated-audio.mp3'
		);
		expect(screen.getByTestId('generated-video')).toHaveAttribute(
			'data-src',
			'local-resource://file/tmp/generated-video.mp4'
		);
	});

	it('restores persisted realtime image, audio, and video tool results', () => {
		const history: AgentHistoryMessage[] = [
			{ role: 'user', content: 'Create three assets.' },
			...mediaTools.flatMap<AgentHistoryMessage>(({ toolCallId, toolName, restoredPath }) => {
				const output = JSON.stringify({ path: restoredPath });
				return [
					{
						role: 'assistant',
						content: '',
						contentBlocks: [
							{
								type: 'tool_use',
								toolUseId: toolCallId,
								toolName,
								toolArgs: { prompt: toolName },
							},
						],
					},
					{
						role: 'tool',
						toolUseId: toolCallId,
						content: output,
						status: 'ok',
						output,
					},
				];
			}),
		];

		const message = historyToChatMessages(history).find((candidate) => candidate.role === 'agent');
		expect(message?.role).toBe('agent');
		if (!message || message.role !== 'agent') throw new Error('Expected restored assistant tools.');
		for (const { toolCallId } of mediaTools) {
			expect(message.tools).toContainEqual(
				expect.objectContaining({ toolCallId, state: 'output-available' })
			);
		}

		render(<AssistantMessage message={message} />);
		expect(screen.getAllByLabelText('Completed')).toHaveLength(3);
		expect(screen.getByRole('img', { name: 'Generated image' })).toHaveAttribute(
			'src',
			'local-resource://file/tmp/restored-image.png'
		);
		expect(screen.getByTestId('generated-audio')).toHaveAttribute(
			'data-src',
			'local-resource://file/tmp/restored-audio.mp3'
		);
		expect(screen.getByTestId('generated-video')).toHaveAttribute(
			'data-src',
			'local-resource://file/tmp/restored-video.mp4'
		);
	});
});
