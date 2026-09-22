import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserInputCard } from '../../../src/renderer/src/pages/home/components/UserInputCard';
import type {
	AgentToolPart,
	PendingUserInput,
} from '../../../src/renderer/src/pages/home/context';

const respondUserInput = jest.fn();
const pending: PendingUserInput = {
	requestId: 'request',
	runId: 'run',
	toolCallId: 'tool',
	inputFingerprint: 'fingerprint',
	expiresAt: new Date(Date.now() + 60_000).toISOString(),
	questions: [
		{
			id: 'scope',
			header: 'Scope',
			question: 'Which scope?',
			options: [
				{ label: 'Small', description: 'Change one part.' },
				{ label: 'Large', description: 'Change the whole flow.' },
			],
		},
	],
};
const tool: AgentToolPart = {
	toolCallId: 'tool',
	type: 'ask',
	state: 'input-available',
	input: { questions: pending.questions },
};

beforeEach(() => {
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: { respondUserInput },
	});
});

it('requires Other text and submits scoped answers', async () => {
	const user = userEvent.setup();
	respondUserInput.mockResolvedValue(true);
	render(<UserInputCard tool={tool} pending={pending} />);

	await user.click(screen.getByRole('radio', { name: /Other/i }));
	await user.click(screen.getByRole('button', { name: 'Continue planning' }));
	expect(screen.getByText(/complete any selected Other field/i)).toBeInTheDocument();

	await user.type(screen.getByRole('textbox', { name: 'Scope other answer' }), 'Middle');
	await user.click(screen.getByRole('button', { name: 'Continue planning' }));
	await waitFor(() =>
		expect(respondUserInput).toHaveBeenCalledWith(pending, [
			{ questionId: 'scope', answer: 'Middle' },
		])
	);
});

it('recovers when the scoped request is stale', async () => {
	const user = userEvent.setup();
	respondUserInput.mockResolvedValue(false);
	render(<UserInputCard tool={tool} pending={pending} />);

	await user.click(screen.getByRole('radio', { name: /Small/i }));
	await user.click(screen.getByRole('button', { name: 'Continue planning' }));
	await waitFor(() => expect(screen.getByText(/no longer active/i)).toBeInTheDocument());
	expect(screen.getByRole('button', { name: 'Continue planning' })).toBeEnabled();
});
