import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Mcp from '../../../src/renderer/src/pages/settings/pages/assistant/tools/Mcp';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: mockTranslate }),
}));

const mockTranslate = (key: string): string => key;
const prefix = 'settings.modelServices.agentTools.mcp';
const registry = jest.fn();
const inspect = jest.fn();
const mcpProps = {
	search: '',
	settings: {},
	disabled: false,
	onChange: jest.fn(),
};

beforeEach(() => {
	jest.clearAllMocks();
	registry.mockResolvedValue({
		servers: [
			{
				id: 'mail',
				source: 'configured',
				data: { type: 'http', url: 'https://mail.example', name: 'Mail' },
			},
			{
				id: 'calendar',
				source: 'configured',
				data: { type: 'http', url: 'https://calendar.example', name: 'Calendar' },
			},
			{
				id: 'disabled',
				source: 'configured',
				data: { type: 'http', url: 'https://disabled.example', name: 'Disabled', enabled: false },
			},
		],
		diagnostics: [],
	});
	inspect.mockResolvedValue({
		ok: true,
		tools: ['read_mail', 'send_mail'],
		toolCount: 2,
		durationMs: 1,
	});
	Object.defineProperty(window, 'mcp', { configurable: true, value: { registry, test: inspect } });
});

it('reads only server metadata on mount and inspects only the selected server', async () => {
	render(<Mcp {...mcpProps} />);
	const show = await screen.findByRole('button', { name: `${prefix}.show: Mail` });
	expect(registry).toHaveBeenCalledTimes(1);
	expect(inspect).not.toHaveBeenCalled();
	await userEvent.click(show);
	expect(await screen.findByText('read_mail')).toBeInTheDocument();
	expect(screen.getByText('send_mail')).toBeInTheDocument();
	expect(inspect).toHaveBeenCalledTimes(1);
	expect(inspect).toHaveBeenCalledWith('mail');
});

it('changes a discovered MCP tool permission with the segmented control', async () => {
	render(<Mcp {...mcpProps} />);
	await userEvent.click(await screen.findByRole('button', { name: `${prefix}.show: Mail` }));
	await userEvent.click(await screen.findByRole('button', { name: 'read_mail: Ask' }));

	expect(mcpProps.onChange).toHaveBeenCalledWith(
		{ kind: 'mcp', serverId: 'mail', toolName: 'read_mail' },
		{ enabled: true, permission: 'ask' }
	);
});

it('does not inspect disabled servers', async () => {
	render(<Mcp {...mcpProps} />);
	const show = await screen.findByRole('button', { name: `${prefix}.show: Disabled` });
	expect(show).toBeDisabled();
	await userEvent.click(show);
	expect(inspect).not.toHaveBeenCalled();
});

it('filters discovered tool names without connecting other servers', async () => {
	const { rerender } = render(<Mcp {...mcpProps} />);
	await userEvent.click(await screen.findByRole('button', { name: `${prefix}.show: Mail` }));
	await screen.findByText('read_mail');
	rerender(<Mcp {...mcpProps} search="read_mail" />);
	expect(screen.getByText('read_mail')).toBeInTheDocument();
	expect(screen.queryByText('send_mail')).not.toBeInTheDocument();
	expect(screen.queryByText('Calendar')).not.toBeInTheDocument();
	expect(inspect).toHaveBeenCalledTimes(1);
});

it('shows inspection errors and allows retry', async () => {
	inspect.mockRejectedValueOnce(new Error('Server offline'));
	render(<Mcp {...mcpProps} />);
	const show = await screen.findByRole('button', { name: `${prefix}.show: Mail` });
	await userEvent.click(show);
	expect(await screen.findByText('Server offline')).toBeInTheDocument();
	await waitFor(() => expect(show).toBeEnabled());
	await userEvent.click(show);
	expect(await screen.findByText('read_mail')).toBeInTheDocument();
	expect(screen.queryByText('Server offline')).not.toBeInTheDocument();
});

it('shows metadata loading errors without inspecting servers', async () => {
	registry.mockRejectedValueOnce(new Error('Registry unavailable'));
	render(<Mcp {...mcpProps} />);
	expect(await screen.findByText('Registry unavailable')).toBeInTheDocument();
	expect(inspect).not.toHaveBeenCalled();
});
