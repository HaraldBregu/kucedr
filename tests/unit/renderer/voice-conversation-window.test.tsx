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
		} as ReturnType<typeof useRealtimeVoice>);

		render(<VoiceConversationWindow chatSessionId="chat-1" />);

		expect(screen.getByLabelText('Voice Agent')).toHaveAttribute('data-state', expectedState);
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'End voice conversation' }).nextElementSibling).toHaveTextContent(
			'1:01'
		);
	});
});
