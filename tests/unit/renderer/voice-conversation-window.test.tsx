import { render, screen } from '@testing-library/react';
import type { PersonaState } from '../../../src/renderer/src/components/persona';
import { VoiceConversationWindow } from '../../../src/renderer/src/components/voice-conversation-window';
import {
	useRealtimeVoice,
	type RealtimeVoiceUiStatus,
} from '../../../src/renderer/src/pages/home/hooks/useRealtimeVoice';

jest.mock('@/components/persona', () => ({
	Persona: ({ state }: { state: string }) => <output aria-label="Voice Agent" data-state={state} />,
}));

jest.mock('@/pages/home/hooks/useRealtimeVoice', () => ({
	useRealtimeVoice: jest.fn(),
}));

const mockedUseRealtimeVoice = jest.mocked(useRealtimeVoice);

describe('VoiceConversationWindow', () => {
	beforeEach(() => {
		Object.defineProperty(window, 'win', { configurable: true, value: { close: jest.fn() } });
	});

	it.each<readonly [RealtimeVoiceUiStatus, boolean, PersonaState, string]>([
		['connecting', false, 'idle', 'Connecting…'],
		['listening', false, 'listening', 'Listening'],
		['listening', true, 'listening', 'Listening'],
		['thinking', false, 'thinking', 'Thinking'],
		['speaking', false, 'speaking', 'Speaking'],
	])('shows the %s persona state', (status, isMuted, expectedState, label) => {
		mockedUseRealtimeVoice.mockReturnValue({
			elapsedMs: 61_000,
			end: jest.fn(),
			errorMessage: null,
			isMuted,
			setMuted: jest.fn(),
			start: jest.fn(),
			status,
			stream: {} as MediaStream,
		} as ReturnType<typeof useRealtimeVoice>);

		render(<VoiceConversationWindow chatSessionId="chat-1" />);

		expect(screen.getByLabelText('Voice Agent')).toHaveAttribute('data-state', expectedState);
		const statusLabel = screen.getByText(label);
		expect(statusLabel.parentElement).toHaveClass('justify-center');
		expect(screen.getByText('1:01')).toBeInTheDocument();
	});
});
