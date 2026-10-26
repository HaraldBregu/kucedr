import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppSidebarFooter } from '../../../src/renderer/src/components/app/SidebarFooter';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { version?: string }): string =>
			options?.version ? `${key} ${options.version}` : key,
	}),
}));

jest.mock('../../../src/renderer/src/contexts/AuthContext', () => ({
	useAuth: () => ({ state: { status: 'signedOut' } }),
}));

jest.mock('../../../src/renderer/src/contexts/chat-session', () => ({
	useChatSession: () => ({ sessionId: 'session' }),
}));

jest.mock('../../../src/renderer/src/pages/home/hooks/audio', () => ({
	ensureAppMicrophoneAccess: jest.fn(),
}));

const getAvailableUpdate = jest.fn();
const installUpdate = jest.fn();
let updateAvailable: ((version: string) => void) | undefined;

beforeEach(() => {
	jest.clearAllMocks();
	updateAvailable = undefined;
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: {
			getAvailableUpdate,
			installUpdate,
			onUpdateAvailable: (callback: (version: string) => void) => {
				updateAvailable = callback;
				return () => { updateAvailable = undefined; };
			},
		},
	});
});

function renderFooter(): void {
	render(<MemoryRouter><AppSidebarFooter /></MemoryRouter>);
}

it('hides the update button when no update is available', async () => {
	getAvailableUpdate.mockResolvedValue(null);
	renderFooter();

	await act(async () => {});

	expect(screen.queryByRole('button', { name: /settings.sidebar.update/ })).not.toBeInTheDocument();
});

it('shows an update found before the sidebar mounted', async () => {
	getAvailableUpdate.mockResolvedValue('1.3.0');
	renderFooter();

	expect(await screen.findByRole('button', { name: 'settings.sidebar.update 1.3.0' })).toBeInTheDocument();
});

it('shows an update announced while the sidebar is open', async () => {
	getAvailableUpdate.mockResolvedValue(null);
	renderFooter();
	await act(async () => {});

	act(() => updateAvailable?.('1.4.0'));

	expect(screen.getByRole('button', { name: 'settings.sidebar.update 1.4.0' })).toBeInTheDocument();
});

it('installs the update and disables the button while it runs', async () => {
	const user = userEvent.setup();
	let finishInstall: () => void = () => {};
	getAvailableUpdate.mockResolvedValue('1.3.0');
	installUpdate.mockReturnValue(new Promise<void>((resolve) => { finishInstall = resolve; }));
	renderFooter();

	await user.click(await screen.findByRole('button', { name: 'settings.sidebar.update 1.3.0' }));

	expect(installUpdate).toHaveBeenCalledTimes(1);
	expect(screen.getByRole('button', { name: 'settings.sidebar.updating' })).toBeDisabled();

	await act(async () => finishInstall());

	expect(screen.getByRole('button', { name: 'settings.sidebar.update 1.3.0' })).toBeEnabled();
});
