import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import type { PersonaState } from '../../../src/renderer/src/components/persona';
import { VoiceWindow } from '../../../src/renderer/src/components/voice-window';
import {
	useRealtimeVoice,
	type RealtimeVoiceUiStatus,
} from '../../../src/renderer/src/pages/home/hooks/useRealtimeVoice';

jest.mock('@/components/voice-agent-visual', () => ({
	VoiceAgentVisual: ({ appearance, state }: { appearance: string; state: string }) => (
		<div
			aria-label="Voice Agent"
			data-appearance={appearance}
			data-state={state === 'listening' ? 'idle' : state}
		/>
	),
}));

jest.mock('@/contexts', () => ({
	useApp: () => ({ voiceAgentAppearance: 'orb-07' }),
}));

jest.mock('@/pages/home/hooks/useRealtimeVoice', () => ({
	useRealtimeVoice: jest.fn(),
}));

const mockedUseRealtimeVoice = jest.mocked(useRealtimeVoice);

describe('VoiceWindow', () => {
	beforeEach(() => {
		Object.defineProperty(window, 'win', { configurable: true, value: { close: jest.fn() } });
	});

	it.each<readonly [RealtimeVoiceUiStatus, boolean, PersonaState]>([
		['connecting', false, 'idle'],
		['listening', false, 'idle'],
		['listening', true, 'idle'],
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

		render(<VoiceWindow chatSessionId="chat-1" />);

		expect(screen.getByLabelText('Voice Agent')).toHaveAttribute('data-state', expectedState);
		expect(screen.getByLabelText('Voice Agent')).toHaveAttribute('data-appearance', 'orb-07');
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'End Voice' }).nextElementSibling
		).toHaveTextContent('1:01');
	});

	it('shows startup errors inside the standalone window', () => {
		mockedUseRealtimeVoice.mockReturnValue({
			elapsedMs: 0,
			end: jest.fn(),
			errorMessage: 'Microphone access was denied.',
			isMuted: false,
			setMuted: jest.fn(),
			start: jest.fn(),
			status: 'error',
			stream: null,
		} as ReturnType<typeof useRealtimeVoice>);

		render(<VoiceWindow chatSessionId="chat-1" />);

		expect(screen.getByRole('alert')).toHaveTextContent('Microphone access was denied.');
		expect(screen.getByRole('alert')).toHaveClass(
			'border-destructive/40',
			'bg-destructive/10',
			'text-destructive'
		);
		expect(screen.getByRole('button', { name: 'End Voice' })).toHaveTextContent(
			'Close'
		);
	});

	it('starts once when mounted in Strict Mode', async () => {
		const start = jest.fn().mockResolvedValue(true);
		mockedUseRealtimeVoice.mockReturnValue({
			elapsedMs: 0,
			end: jest.fn(),
			errorMessage: null,
			isMuted: false,
			setMuted: jest.fn(),
			start,
			status: 'idle',
			stream: null,
		} as ReturnType<typeof useRealtimeVoice>);

		render(
			<StrictMode>
				<VoiceWindow chatSessionId="chat-1" />
			</StrictMode>
		);

		await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
	});
});
