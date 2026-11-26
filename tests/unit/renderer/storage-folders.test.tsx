import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import StoragePage from '../../../src/renderer/src/pages/settings/pages/cloud/Page';
import type { StorageProvider } from '../../../src/shared/storage_types';
import mockTranslations from '../../../resources/i18n/en/main.json';

jest.mock('../../../src/renderer/src/contexts/AuthContext', () => ({
	useAuth: () => {
		throw new Error('Storage backup must not require account access.');
	},
}));

jest.mock('react-i18next', () => {
	const t = (key: string): string => {
		let value: unknown = mockTranslations;
		for (const part of key.split('.')) {
			value =
				value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined;
		}
		return String(value ?? key);
	};
	return { useTranslation: () => ({ t }) };
});

const providers: StorageProvider[] = [
	{
		id: 'primary',
		name: 'Production files',
		bucket: 'files',
		region: 'us-east-1',
		endpoint: '',
		accessKeyId: 'test-access',
		hasSecretAccessKey: true,
		forcePathStyle: false,
	},
	{
		id: 'archive',
		name: 'Archive',
		bucket: 'archive',
		region: 'eu-west-1',
		endpoint: '',
		accessKeyId: 'test-access',
		hasSecretAccessKey: true,
		forcePathStyle: false,
	},
];
const settings = { paths: ['/data/agent'], syncEnabled: false, syncCronExpression: '0 3 * * *' };
const storageApi = {
	listProviders: jest.fn(),
	getSettings: jest.fn(),
	saveSettings: jest.fn(),
	syncFolders: jest.fn(),
	pickFolders: jest.fn(),
	getOperationStatus: jest.fn(),
	onOperationStatusChanged: jest.fn(),
	backup: jest.fn(),
	restore: jest.fn(),
	getNextRun: jest.fn(),
};
const scriptsApi = { list: jest.fn() };

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'storage', { configurable: true, value: storageApi });
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: { getVault: jest.fn().mockResolvedValue({ enabled: false, available: true }) },
	});
	Object.defineProperty(window, 'scripts', { configurable: true, value: scriptsApi });
	scriptsApi.list.mockResolvedValue([{ name: 'backup-s3', title: 'S3 backup', type: 'STORAGE' }]);
	storageApi.getNextRun.mockResolvedValue(undefined);
	storageApi.listProviders.mockResolvedValue(providers);
	storageApi.getSettings.mockResolvedValue(settings);
	storageApi.saveSettings.mockImplementation(async (value) => value);
	storageApi.syncFolders.mockResolvedValue([
		{ key: 'agent', path: '/data/agent' },
		{ key: 'library', path: '/Users/haraldbregu/.kucedr/library' },
	]);
	storageApi.getOperationStatus.mockResolvedValue(undefined);
	storageApi.onOperationStatusChanged.mockReturnValue(jest.fn());
	storageApi.backup.mockResolvedValue({
		operationId: 'backup-1',
		operation: 'backup',
		trigger: 'manual',
		state: 'running',
		startedAt: '2026-09-08T10:00:00Z',
		transferred: 0,
		skipped: 0,
		failed: 0,
		revision: 1,
	});
});

it.each([
	[true, false, true],
	[true, true, false],
	[false, false, false],
])('shows the portability warning for vault=%s and saved passphrase=%s', async (enabled, hasPassphrase, visible) => {
	jest.mocked(window.app.getVault).mockResolvedValue({ enabled, available: true });
	storageApi.listProviders.mockResolvedValue([
		{ ...providers[0], hasPassphrase: !hasPassphrase },
		{ ...providers[1], hasPassphrase },
	]);
	storageApi.getSettings.mockResolvedValue({ ...settings, providerId: 'archive', serviceId: 'backup-s3' });
	render(<MemoryRouter><StoragePage /></MemoryRouter>);
	expect(await screen.findByRole('button', { name: mockTranslations.settings.storage.backup })).toBeEnabled();
	expect(Boolean(screen.queryByText(mockTranslations.settings.storageProviders.portabilityWarning))).toBe(visible);
});

it('shows the storage service description beneath the title', async () => {
	render(
		<MemoryRouter>
			<StoragePage />
		</MemoryRouter>
	);
	const title = screen.getByRole('heading', { name: 'Cloud', exact: true });
	const description = await screen.findByText(mockTranslations.settings.storage.service.description);
	expect(
		title.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING
	).toBeTruthy();
	expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Add folders' })).toBeEnabled();
	expect(screen.getByRole('combobox', { name: 'Storage service' })).toBeEnabled();
	expect(screen.queryByText('Media library')).not.toBeInTheDocument();
	expect(screen.queryByText('/Users/haraldbregu/.kucedr/library')).not.toBeInTheDocument();
	expect(screen.queryByRole('link', { name: 'Manage storage' })).not.toBeInTheDocument();
});

it('keeps backup controls disabled when no providers exist', async () => {
	storageApi.listProviders.mockResolvedValue([]);
	render(
		<MemoryRouter>
			<StoragePage />
		</MemoryRouter>
	);
	expect(
		await screen.findByText(mockTranslations.settings.storage.service.description)
	).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Backup' })).toBeDisabled();
	expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled();
	expect(screen.queryByRole('link', { name: 'Manage storage' })).not.toBeInTheDocument();
});

it('retries a failed provider load and restores the saved selection', async () => {
	const user = userEvent.setup();
	storageApi.getSettings.mockResolvedValue({
		...settings,
		serviceId: 'backup-s3',
		providerId: 'primary',
	});
	storageApi.listProviders.mockRejectedValueOnce(new Error('Could not open storage credentials'));
	render(
		<MemoryRouter>
			<StoragePage />
		</MemoryRouter>
	);
	expect(await screen.findByRole('alert')).toHaveTextContent('Could not load storage settings.');
	expect(screen.getByRole('button', { name: 'Add folders' })).toBeEnabled();
	await user.click(screen.getByRole('button', { name: 'Try Again' }));
	await waitFor(() => expect(screen.getByRole('button', { name: 'Add folders' })).toBeEnabled());
	expect(screen.getByRole('combobox', { name: 'Storage service' })).toHaveTextContent('S3 backup');
	expect(screen.getByText('Production files · files')).toBeInTheDocument();
});

it('keeps a failed settings save editable and does not start a backup', async () => {
	const user = userEvent.setup();
	storageApi.getSettings.mockResolvedValue({
		...settings,
		serviceId: 'backup-s3',
		providerId: 'primary',
	});
	storageApi.saveSettings.mockRejectedValueOnce(new Error('Unable to save'));
	render(
		<MemoryRouter>
			<StoragePage />
		</MemoryRouter>
	);
	await user.click(await screen.findByRole('button', { name: 'Backup' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Could not save storage settings.');
	expect(storageApi.backup).not.toHaveBeenCalled();
	expect(screen.queryByRole('link', { name: 'Manage storage' })).not.toBeInTheDocument();
});
