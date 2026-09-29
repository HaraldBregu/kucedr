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

it('maps listening to Orb 07 idle motion with the input level', () => {
	render(<VoiceAgentVisual appearance="orb-07" state="listening" level={0.28} />);

	expect(screen.getByTestId('orb-07')).toHaveAttribute('data-state', 'idle');
	expect(screen.getByTestId('orb-07')).toHaveAttribute('data-input', '0.28');
});
