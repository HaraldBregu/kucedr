import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { McpAuthorizationCard } from '../../../src/renderer/src/pages/home/components/McpAuthorizationCard';
import type { AgentToolPart } from '../../../src/renderer/src/pages/home/context';

const oauthStatus = jest.fn();
const oauthStart = jest.fn();
const test = jest.fn();
const tool: AgentToolPart = {
	toolCallId: 'authorize',
	type: 'request_mcp_authorization',
	state: 'output-available',
	output: JSON.stringify({
		status: 'authorization_required',
		serverId: 'gmail',
		serverName: 'Gmail',
	}),
};

beforeEach(() => {
	Object.defineProperty(window, 'mcp', {
		configurable: true,
		value: { oauthStatus, oauthStart, test },
	});
	oauthStatus.mockResolvedValue(false);
});

it('uses the Settings OAuth flow and updates the chat card after authorization', async () => {
	const user = userEvent.setup();
	oauthStart.mockResolvedValue({ status: 'authorized' });
	render(<McpAuthorizationCard tool={tool} />);

	await user.click(screen.getByRole('button', { name: 'Authorize' }));
	await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Authorized'));
	expect(oauthStart).toHaveBeenCalledWith('gmail');
});

it('shows an OAuth error and keeps the authorization action available', async () => {
	const user = userEvent.setup();
	oauthStart.mockRejectedValue(new Error('Access denied'));
	render(<McpAuthorizationCard tool={tool} />);

	await user.click(screen.getByRole('button', { name: 'Authorize' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
	expect(screen.getByRole('button', { name: 'Authorize' })).toBeEnabled();
});

it('restores the authorized message when history is reopened', async () => {
	oauthStatus.mockResolvedValue(true);
	test.mockResolvedValue({ ok: true });
	render(<McpAuthorizationCard tool={tool} />);

	await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Authorized'));
	expect(test).toHaveBeenCalledWith('gmail');
});
