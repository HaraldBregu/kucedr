import { render, screen } from '@testing-library/react';
import { VoiceAgentVisual } from '../../../src/renderer/src/components/voice-agent-visual';

jest.mock('@/components/persona', () => ({
	Persona: ({ state }: { state: string }) => <div data-testid="persona" data-state={state} />,
}));

jest.mock('orb-ui', () => ({
	Orb: ({
		theme,
		signal,
	}: {
		theme: string;
		signal: { state: string; inputVolume: number; outputVolume: number };
	}) => (
		<div
			data-testid={theme}
			data-input={signal.inputVolume}
			data-output={signal.outputVolume}
			data-state={signal.state}
		/>
	),
}));

it('renders the current Voice Agent visual', () => {
	render(<VoiceAgentVisual appearance="persona" state="thinking" />);

	expect(screen.getByTestId('persona')).toHaveAttribute('data-state', 'thinking');
	expect(screen.queryByTestId('radial')).not.toBeInTheDocument();
});

it.each(['persona', 'radial'] as const)('renders listening for %s', (appearance) => {
	render(<VoiceAgentVisual appearance={appearance} state="listening" level={0.28} />);

	const visual = screen.getByTestId(appearance);
	expect(visual).toHaveAttribute('data-state', appearance === 'persona' ? 'idle' : 'listening');
	if (appearance === 'radial') expect(visual).toHaveAttribute('data-input', '0.28');
});
