import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonaPage from '../../../src/renderer/src/pages/settings/pages/general/persona/Page';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

jest.mock('@/components/persona', () => ({
	Persona: ({ state }: { state: string }) => (
		<div role="img" aria-label="Voice Agent preview" data-state={state} />
	),
}));

it('previews each Voice Agent state', async () => {
	const user = userEvent.setup();
	render(<PersonaPage />);

	const preview = screen.getByRole('img', { name: 'Voice Agent preview' });
	expect(preview).toHaveAttribute('data-state', 'idle');

	await user.click(screen.getByRole('button', { name: 'settings.voiceAgent.states.speaking' }));

	expect(preview).toHaveAttribute('data-state', 'speaking');
});
