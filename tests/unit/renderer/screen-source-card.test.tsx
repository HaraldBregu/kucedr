import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScreenSourceCard } from '../../../src/renderer/src/pages/home/components/ScreenSourceCard';
import type { AgentToolPart, PendingUserInput } from '../../../src/renderer/src/pages/home/context';

const respondUserInput = jest.fn();

const pending: PendingUserInput = {
	requestId: 'request',
	runId: 'run',
	toolCallId: 'tool',
	inputFingerprint: 'fingerprint',
	expiresAt: new Date(Date.now() + 60_000).toISOString(),
	questions: [
		{ id: 'screen-source', header: 'Screen', question: 'Choose a screen to record.', options: [] },
	],
};

const tool: AgentToolPart = {
	toolCallId: 'tool',
	type: 'select_screen_source',
	state: 'input-available',
	input: {
		sources: [
			{ id: 'screen:1', name: 'Display 1', type: 'screen' },
			{ id: 'window:2', name: 'Kucedr', type: 'window' },
		],
	},
};

beforeEach(() => {
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: { respondUserInput },
	});
	respondUserInput.mockReset();
});

it('submits a selected source immediately without a confirmation button', async () => {
	const user = userEvent.setup();
	respondUserInput.mockResolvedValue(true);
	render(<ScreenSourceCard tool={tool} pending={pending} />);

	await user.click(screen.getByRole('button', { name: /Kucedr/i }));

	await waitFor(() =>
		expect(respondUserInput).toHaveBeenCalledWith(pending, [
			{ questionId: 'screen-source', answer: 'window:2' },
		])
	);
	expect(screen.queryByRole('button', { name: 'Start recording' })).not.toBeInTheDocument();
});
