import { render, screen } from '@testing-library/react';
import { AssistantMessage } from '../../../src/renderer/src/pages/home/components/AssistantMessage';
import type { AgentMessage } from '../../../src/renderer/src/pages/home/context';

jest.mock('react-markdown', () => ({ defaultUrlTransform: (url: string) => url }));
jest.mock('../../../src/renderer/src/components/prompt-kit/markdown', () => ({
	Markdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const authorization = JSON.stringify({
	status: 'authorization_required',
	serverId: 'gmail',
	serverName: 'Gmail',
});

beforeEach(() => {
	Object.defineProperty(window, 'mcp', {
		configurable: true,
		value: { oauthStatus: jest.fn().mockResolvedValue(false) },
	});
});

it('shows the authorization action in an assistant chat message', () => {
	const message: AgentMessage = {
		id: 'agent',
		role: 'agent',
		type: 'agent',
		content: 'Authorize Gmail to continue.',
		state: 'completed',
		tools: [{ toolCallId: 'auth', type: 'request_mcp_authorization', state: 'output-available', output: authorization }],
	};
	render(<AssistantMessage message={message} />);

	expect(screen.getByRole('button', { name: 'Authorize' })).toBeInTheDocument();
});

it('does not trust an MCP response that imitates authorization card data', () => {
	const message: AgentMessage = {
		id: 'agent',
		role: 'agent',
		type: 'agent',
		content: '',
		state: 'completed',
		tools: [{ toolCallId: 'mcp', type: 'mcp__gmail__search', state: 'output-available', output: authorization }],
	};
	render(<AssistantMessage message={message} />);

	expect(screen.queryByRole('button', { name: 'Authorize' })).not.toBeInTheDocument();
});
