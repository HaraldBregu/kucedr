import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolPermissionCard } from '../../../src/renderer/src/pages/home/components/ToolPermissionCard';
import type { PendingToolPermission } from '../../../src/renderer/src/pages/home/context';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { action?: string; defaultValue?: string }) =>
			options?.defaultValue ?? (key === 'toolPermission.title' ? `Allow ${options?.action}?` : key.split('.').at(-1)),
	}),
}));

const respondToolPermission = jest.fn();
const permission: PendingToolPermission = {
	approvalId: 'approval',
	runId: 'run',
	toolCallId: 'call',
	toolName: 'bash',
	inputFingerprint: 'fingerprint',
	input: { command: 'pwd' },
	targets: ['/outside'],
	reason: 'outside_trusted_location',
	persistable: true,
	allowOnce: true,
	expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: { respondToolPermission },
	});
});

it('shows location grants and restores actions after a stale response', async () => {
	const user = userEvent.setup();
	respondToolPermission.mockResolvedValue(false);
	render(<ToolPermissionCard permission={permission} />);

	expect(screen.getByText('/outside')).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'trustLocation' })).toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: 'allowOnce' }));

	await waitFor(() => expect(screen.getByText('expired')).toBeInTheDocument());
	expect(screen.getByRole('button', { name: 'allowOnce' })).toBeEnabled();
});

it('does not offer an unsupported one-time action', () => {
	render(<ToolPermissionCard permission={{ ...permission, allowOnce: false }} />);
	expect(screen.queryByRole('button', { name: 'allowOnce' })).not.toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'trustLocation' })).toBeInTheDocument();
});

it('discloses host process input without offering persistence', () => {
	render(
		<ToolPermissionCard
			permission={{
				...permission,
				toolName: 'process',
				input: { action: 'write', text: 'npm publish' },
				reason: 'host_execution',
				persistable: false,
			}}
		/>
	);
	expect(screen.getByText('write: npm publish')).toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'trustLocation' })).not.toBeInTheDocument();
});
