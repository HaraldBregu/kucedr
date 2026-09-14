import { render, screen } from '@testing-library/react';
import type { PersonaState } from '../../../src/renderer/src/components/persona';
import { VoiceConversationWindow } from '../../../src/renderer/src/components/voice-conversation-window';
import {
	useRealtimeVoice,
	type RealtimeVoiceUiStatus,
} from '../../../src/renderer/src/pages/home/hooks/useRealtimeVoice';

jest.mock('@/components/persona', () => ({
	Persona: ({ state }: { state: string }) => <div aria-label="Voice Agent" data-state={state} />,
}));

jest.mock('@/pages/home/hooks/useRealtimeVoice', () => ({
	useRealtimeVoice: jest.fn(),
}));

const mockedUseRealtimeVoice = jest.mocked(useRealtimeVoice);

describe('VoiceConversationWindow', () => {
	beforeEach(() => {
		Object.defineProperty(window, 'win', { configurable: true, value: { close: jest.fn() } });
	});

	it.each<readonly [RealtimeVoiceUiStatus, boolean, PersonaState]>([
		['connecting', false, 'idle'],
		['listening', false, 'listening'],
		['listening', true, 'listening'],
		['thinking', false, 'thinking'],
		['speaking', false, 'speaking'],
	])('shows the %s persona state', (status, isMuted, expectedState) => {
		mockedUseRealtimeVoice.mockReturnValue({
			elapsedMs: 61_000,
			end: jest.fn(),
			errorMessage: null,
			isMuted,
			setMuted: jest.fn(),
			start: jest.fn(),
			status,
			stream: {} as MediaStream,
			transcript: [],
		} as ReturnType<typeof useRealtimeVoice>);

		render(<VoiceConversationWindow chatSessionId="chat-1" />);

		expect(screen.getByLabelText('Voice Agent')).toHaveAttribute('data-state', expectedState);
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'End voice conversation' }).nextElementSibling
		).toHaveTextContent('1:01');
	});

	it('keeps the complete clipped transcript thread above the window center', () => {
		mockedUseRealtimeVoice.mockReturnValue({
			elapsedMs: 0,
			end: jest.fn(),
			errorMessage: null,
			isMuted: false,
			setMuted: jest.fn(),
			start: jest.fn(),
			status: 'listening',
			stream: {} as MediaStream,
			transcript: [
				{ id: '1', role: 'user', content: 'First message' },
				{ id: '2', role: 'assistant', content: 'Second message' },
				{ id: '3', role: 'user', content: 'Third message' },
				{ id: '4', role: 'assistant', content: 'Latest message' },
			],
		} as ReturnType<typeof useRealtimeVoice>);

		render(<VoiceConversationWindow chatSessionId="chat-1" />);

		const transcript = screen.getByRole('region', { name: 'Voice conversation transcript' });
		expect(transcript).toHaveClass(
			'left-[calc(100%-30px)]',
			'bottom-1/2',
			'justify-end',
			'overflow-y-auto'
		);
		const messages = screen.getByRole('list');
		expect(messages).toHaveTextContent('First message');
		expect(messages).toHaveTextContent('Second message');
		expect(messages).toHaveTextContent('Latest message');
	});
});
