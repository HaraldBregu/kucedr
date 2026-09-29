import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonaPage from '../../../src/renderer/src/pages/settings/pages/general/persona/Page';

const mockSetVoiceAgentAppearance = jest.fn();

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

jest.mock('@/components/voice-agent-visual', () => ({
	VoiceAgentVisual: ({ appearance, state }: { appearance: string; state: string }) => (
		<div
			role="img"
			aria-label="Voice Agent preview"
			data-appearance={appearance}
			data-state={state}
		/>
	),
}));

jest.mock('@/contexts', () => ({
	useApp: () => {
		const React = jest.requireActual<typeof import('react')>('react');
		const [voiceAgentAppearance, setAppearance] = React.useState('persona');
		return {
			voiceAgentAppearance,
			setVoiceAgentAppearance: (appearance: string) => {
				mockSetVoiceAgentAppearance(appearance);
				setAppearance(appearance);
			},
		};
	},
}));

it('previews each Voice Agent state', async () => {
	const user = userEvent.setup();
	render(<PersonaPage />);

	const preview = screen.getByRole('img', { name: 'Voice Agent preview' });
	expect(preview).toHaveAttribute('data-state', 'idle');
	expect(
		screen.queryByRole('button', { name: 'settings.voiceAgent.states.listening' })
	).not.toBeInTheDocument();

	await user.click(screen.getByRole('button', { name: 'settings.voiceAgent.states.speaking' }));

	expect(preview).toHaveAttribute('data-state', 'speaking');
});

it('selects Nebula as the Voice Agent appearance', async () => {
	const user = userEvent.setup();
	render(<PersonaPage />);

	await user.click(screen.getByRole('button', { name: 'settings.voiceAgent.appearances.orb-07' }));

	expect(mockSetVoiceAgentAppearance).toHaveBeenCalledWith('orb-07');
	expect(screen.getByRole('img', { name: 'Voice Agent preview' })).toHaveAttribute(
		'data-appearance',
		'orb-07'
	);
});
