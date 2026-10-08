import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { McpAuthorizationCard } from '../../../src/renderer/src/pages/home/components/McpAuthorizationCard';
import type { AgentToolPart, PendingUserInput } from '../../../src/renderer/src/pages/home/context';

const oauthStart = jest.fn();
const respondUserInput = jest.fn();
const tool: AgentToolPart = {
	toolCallId: 'authorize',
	type: 'request_mcp_authorization',
	state: 'input-available',
	input: { serverId: 'gmail', serverName: 'Gmail', toolName: 'Search Gmail', force: true },
};
const pending: PendingUserInput = {
	requestId: 'request',
	runId: 'run',
	toolCallId: 'authorize',
	inputFingerprint: 'fingerprint',
	expiresAt: new Date(Date.now() + 60_000).toISOString(),
	questions: [
		{ id: 'mcp-authorization', header: 'MCP', question: 'Authorize Gmail?', options: [] },
	],
};

beforeEach(() => {
	Object.defineProperty(window, 'mcp', { configurable: true, value: { oauthStart } });
	Object.defineProperty(window, 'agent', { configurable: true, value: { respondUserInput } });
	oauthStart.mockReset();
	respondUserInput.mockReset();
	respondUserInput.mockResolvedValue(true);
});

it('holds the run until OAuth succeeds, then submits authorization', async () => {
	const user = userEvent.setup();
	let finishOauth!: () => void;
	oauthStart.mockReturnValue(
		new Promise<void>((resolve) => {
			finishOauth = resolve;
		})
	);
	render(<McpAuthorizationCard tool={tool} pending={pending} />);

	await user.click(screen.getByRole('button', { name: 'Authorize' }));
	expect(oauthStart).toHaveBeenCalledWith('gmail', true);
	expect(respondUserInput).not.toHaveBeenCalled();
	finishOauth();
	await waitFor(() =>
		expect(respondUserInput).toHaveBeenCalledWith(pending, [
			{ questionId: 'mcp-authorization', answer: 'authorized' },
		])
	);
	await waitFor(() =>
		expect(screen.queryByRole('button', { name: 'Authorize' })).not.toBeInTheDocument()
	);
});

it('cancels the run without waiting for OAuth', async () => {
	const user = userEvent.setup();
	render(<McpAuthorizationCard tool={tool} pending={pending} />);
	await user.click(screen.getByRole('button', { name: 'Cancel' }));
	expect(respondUserInput).toHaveBeenCalledWith(pending, [
		{ questionId: 'mcp-authorization', answer: 'cancel' },
	]);
	expect(oauthStart).not.toHaveBeenCalled();
});

it('keeps Cancel available while OAuth is pending', async () => {
	const user = userEvent.setup();
	let finishOauth!: () => void;
	oauthStart.mockReturnValue(
		new Promise<void>((resolve) => {
			finishOauth = resolve;
		})
	);
	render(<McpAuthorizationCard tool={tool} pending={pending} />);
	await user.click(screen.getByRole('button', { name: 'Authorize' }));
	await user.click(screen.getByRole('button', { name: 'Cancel' }));
	finishOauth();
	await waitFor(() => expect(respondUserInput).toHaveBeenCalledTimes(1));
	expect(respondUserInput).toHaveBeenCalledWith(pending, [
		{ questionId: 'mcp-authorization', answer: 'cancel' },
	]);
});

it('shows OAuth errors and keeps the authorization action available', async () => {
	const user = userEvent.setup();
	oauthStart.mockRejectedValue(new Error('Access denied'));
	render(<McpAuthorizationCard tool={tool} pending={pending} />);
	await user.click(screen.getByRole('button', { name: 'Authorize' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
	expect(screen.getByRole('button', { name: 'Authorize' })).toBeEnabled();
	expect(screen.getByText('After authorization, Search Gmail will be retried automatically.')).toBeInTheDocument();
});

it('hides the card after authorization and for unrelated server statuses', () => {
	const { rerender } = render(
		<McpAuthorizationCard tool={{ ...tool, output: { status: 'authorized', serverId: 'gmail' } }} />
	);
	expect(screen.queryByText(/authorized/i)).not.toBeInTheDocument();
	expect(screen.queryByRole('button')).not.toBeInTheDocument();
	rerender(
		<McpAuthorizationCard tool={{ ...tool, output: { status: 'connected', serverId: 'gmail' } }} />
	);
	expect(screen.queryByText(/connected/i)).not.toBeInTheDocument();
});

it('keeps the cancelled result visible', () => {
	render(
		<McpAuthorizationCard tool={{ ...tool, output: { status: 'cancelled', serverId: 'gmail' } }} />
	);
	expect(screen.getByText('Authorization cancelled')).toBeInTheDocument();
});
