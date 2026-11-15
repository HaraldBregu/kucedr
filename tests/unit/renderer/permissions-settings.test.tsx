import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PermissionsPage from '../../../src/renderer/src/pages/settings/pages/permissions/Page';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) ?? key }),
}));

const rule = (root: string) => ({ root, recursive: true });
const workspaceRule = rule('/workspace');
const permissions = {
	read: { allow: [workspaceRule, rule('/shared')], deny: [rule('/blocked')] },
	write: { allow: [workspaceRule, rule('/shared')], deny: [rule('/blocked')] },
	exec: { allow: [workspaceRule], deny: [rule('/blocked')] },
};
const view = {
	...permissions,
	protected: { read: ['/home/.ssh'], write: ['/home/.zshrc'] },
	dropped: [],
};
const agentApi = {
	policyGet: jest.fn(),
	getWorkspaceLocation: jest.fn(),
	policyPickDirectory: jest.fn(),
	policyNormalizeDirectory: jest.fn(),
	policySet: jest.fn(),
	policyReset: jest.fn(),
};
const appApi = {
	getSandboxStatus: jest.fn(),
	setupSandbox: jest.fn(),
};

beforeAll(() => {
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
});

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'agent', { configurable: true, value: agentApi });
	Object.defineProperty(window, 'app', { configurable: true, value: appApi });
	agentApi.policyGet.mockResolvedValue(JSON.parse(JSON.stringify(view)));
	agentApi.getWorkspaceLocation.mockResolvedValue('/workspace');
	agentApi.policyPickDirectory.mockResolvedValue(undefined);
	agentApi.policyNormalizeDirectory.mockImplementation(async (value: string) => value);
	agentApi.policySet.mockImplementation(async (value) => ({ ...view, ...value }));
	agentApi.policyReset.mockResolvedValue(JSON.parse(JSON.stringify(view)));
	appApi.getSandboxStatus.mockResolvedValue({ state: 'ready', platform: 'darwin' });
});

describe('Permissions settings', () => {
	it('renders the fixed workspace first and blocked paths distinctly', async () => {
		render(<PermissionsPage />);

		const workspace = await screen.findByText('/workspace');
		expect(workspace.closest('[class*="grid"]')).toHaveTextContent('workspaceDescription');
		expect(screen.getByText('/blocked').closest('[class*="grid"]')).toHaveTextContent('blocked');
		expect(screen.getAllByRole('button', { name: 'removeLocation' })).toHaveLength(2);
	});

	it('shows the protected locations read-only', async () => {
		render(<PermissionsPage />);

		expect((await screen.findByText('/home/.ssh')).closest('[class*="grid"]')).toHaveTextContent(
			'builtIn'
		);
		expect(screen.getByText('/home/.zshrc')).toBeInTheDocument();
		expect(screen.queryByText('droppedNotice')).not.toBeInTheDocument();
	});

	it('shows rules that could not be converted', async () => {
		agentApi.policyGet.mockResolvedValue({ ...view, dropped: ['/old/*/glob/**'] });
		render(<PermissionsPage />);

		expect(await screen.findByText('droppedNotice')).toBeInTheDocument();
	});

	it('uses the picker, adds one deduplicated trusted location, and saves the schema', async () => {
		const user = userEvent.setup();
		agentApi.policyPickDirectory.mockResolvedValue('/picked');
		render(<PermissionsPage />);
		await screen.findByText('/workspace');

		await user.click(screen.getByRole('button', { name: 'browse' }));
		await waitFor(() =>
			expect(screen.getByPlaceholderText('pathPlaceholder')).toHaveValue('/picked')
		);
		await user.click(screen.getByRole('button', { name: 'add' }));
		expect(await screen.findByText('/picked')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'save' }));

		await waitFor(() =>
			expect(agentApi.policySet).toHaveBeenCalledWith({
				read: { ...permissions.read, allow: [...permissions.read.allow, rule('/picked')] },
				write: { ...permissions.write, allow: [...permissions.write.allow, rule('/picked')] },
				exec: { ...permissions.exec, allow: [...permissions.exec.allow, rule('/picked')] },
			})
		);
	});

	it('removes a custom rule from every tool while keeping the workspace', async () => {
		const user = userEvent.setup();
		render(<PermissionsPage />);
		const shared = await screen.findByText('/shared');
		const row = shared.closest('[class*="grid"]');
		expect(row).not.toBeNull();
		await user.click(within(row as HTMLElement).getByRole('button', { name: 'removeLocation' }));
		await user.click(screen.getByRole('button', { name: 'save' }));

		await waitFor(() =>
			expect(agentApi.policySet).toHaveBeenCalledWith({
				read: { ...permissions.read, allow: [workspaceRule] },
				write: { ...permissions.write, allow: [workspaceRule] },
				exec: permissions.exec,
			})
		);
	});

	it('resets through the single policy API', async () => {
		const user = userEvent.setup();
		render(<PermissionsPage />);
		await screen.findByText('/workspace');
		await user.click(screen.getByRole('button', { name: 'reset' }));
		await waitFor(() => expect(agentApi.policyReset).toHaveBeenCalledTimes(1));
	});
});
