import { render, screen } from '@testing-library/react';
import { VoiceAgentVisual } from '../../../src/renderer/src/components/voice-agent-visual';

jest.mock('@/components/persona', () => ({
	Persona: ({ state }: { state: string }) => <div data-testid="persona" data-state={state} />,
}));

jest.mock('@/components/orbs/orb-07', () => ({
	Orb07: ({ state, volumes }: { state: string; volumes: { input: number; output: number } }) => (
		<div
			data-testid="orb-07"
			data-input={volumes.input}
			data-output={volumes.output}
			data-state={state}
		/>
	),
}));

it('renders the current Voice Agent visual', () => {
	render(<VoiceAgentVisual appearance="persona" state="thinking" />);

	expect(screen.getByTestId('persona')).toHaveAttribute('data-state', 'thinking');
	expect(screen.queryByTestId('orb-07')).not.toBeInTheDocument();
});

it.each(['persona', 'orb-07'] as const)('maps listening to idle for %s', (appearance) => {
	render(<VoiceAgentVisual appearance={appearance} state="listening" level={0.28} />);

	const visual = screen.getByTestId(appearance);
	expect(visual).toHaveAttribute('data-state', 'idle');
	if (appearance === 'orb-07') expect(visual).toHaveAttribute('data-input', '0.28');
});
