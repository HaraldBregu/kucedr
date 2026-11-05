import { fireEvent, render, screen } from '@testing-library/react';
import { PromptSubmit } from '@/components/prompt-submit';

jest.mock('@/components/ui/bar-wave-animation', () => ({
	BarWaveAnimation: () => <div data-testid="voice-waveform" />,
}));

jest.mock('@/components/voice-agent-visual', () => ({
	VoiceAgentVisual: () => <div data-testid="persona" />,
}));

jest.mock('@/contexts', () => ({
	useApp: () => ({ voiceAgentAppearance: 'persona' }),
}));

describe('PromptSubmit', () => {
	it('disables the submit button when disabled is set', () => {
		const onAction = jest.fn();
		render(<PromptSubmit isLoading={false} disabled onAction={onAction} />);

		const button = screen.getByRole('button', { name: 'Send message' });
		expect(button).toBeDisabled();
		fireEvent.click(button);
		expect(onAction).not.toHaveBeenCalled();
	});

	it('calls onAction when enabled', () => {
		const onAction = jest.fn();
		render(<PromptSubmit isLoading={false} onAction={onAction} />);

		fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
		expect(onAction).toHaveBeenCalledTimes(1);
	});
});
