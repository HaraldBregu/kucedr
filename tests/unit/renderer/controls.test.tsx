import { render, screen } from '@testing-library/react';
import { PromptInputControls } from '@/components/ui/controls';

it('shows the response loader only while the agent is responding', () => {
	const buttons = {
		leadingAction: <button type="button">Add attachment</button>,
		content: <button type="button">Change model</button>,
	};
	const { rerender } = render(<PromptInputControls {...buttons} isLoading={false} />);

	expect(screen.queryByRole('status', { name: 'Kucedr is responding' })).not.toBeInTheDocument();
	rerender(<PromptInputControls {...buttons} isLoading />);
	expect(screen.getByRole('status', { name: 'Kucedr is responding' })).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Add attachment' })).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Change model' })).toBeInTheDocument();
	rerender(<PromptInputControls {...buttons} isLoading={false} />);
	expect(screen.queryByRole('status', { name: 'Kucedr is responding' })).not.toBeInTheDocument();
});
