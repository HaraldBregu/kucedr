import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CloudPage from '../../../src/renderer/src/pages/settings/pages/cloud/Page';
import type { StorageProvider } from '../../../src/shared/storage_types';
import mockTranslations from '../../../resources/i18n/en/main.json';

jest.mock('../../../src/renderer/src/contexts/AuthContext', () => ({
	useAuth: () => {
		throw new Error('Cloud backup must not require account access.');
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
};

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'storage', { configurable: true, value: storageApi });
	storageApi.listProviders.mockResolvedValue(providers);
	storageApi.getSettings.mockResolvedValue(settings);
	storageApi.saveSettings.mockImplementation(async (value) => value);
	storageApi.syncFolders.mockResolvedValue([{ key: 'agent', path: '/data/agent' }]);
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

it('shows storage selection beneath the title and before backup setup without login or key sync', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<CloudPage />
		</MemoryRouter>
	);
	const title = screen.getByRole('heading', { name: 'Cloud', exact: true });
	const disclosure = await screen.findByRole('button', { name: /^Storage provider/ });
	expect(disclosure).toHaveAttribute('aria-expanded', 'false');
	expect(disclosure).toHaveTextContent('Select storage provider');
	expect(screen.queryByRole('combobox', { name: 'Storage provider' })).not.toBeInTheDocument();
	await user.click(disclosure);
	expect(disclosure).toHaveAttribute('aria-expanded', 'true');
	const selector = screen.getByRole('combobox', { name: 'Storage provider' });
	const backup = screen.getByRole('heading', { name: 'Cloud Backup' });
	expect(title.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	expect(selector.compareDocumentPosition(backup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	expect(screen.queryByText(/sign in|supabase|secure key sync/i)).not.toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Back up now' })).toBeDisabled();
	expect(screen.getByRole('link', { name: 'Manage storage' })).toHaveAttribute(
		'href',
		'/settings/providers/storage'
	);
});

it('saves a chosen provider before starting backup while signed out', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<CloudPage />
		</MemoryRouter>
	);
	await user.click(await screen.findByRole('button', { name: /^Storage provider/ }));
	await user.click(screen.getByRole('combobox', { name: 'Storage provider' }));
	await user.click(await screen.findByRole('option', { name: 'Archive' }));
	expect(screen.getByRole('button', { name: /^Storage provider/ })).toHaveTextContent('Archive');
	await user.click(screen.getByRole('button', { name: 'Back up now' }));
	await waitFor(() => expect(storageApi.backup).toHaveBeenCalledTimes(1));
	expect(storageApi.saveSettings).toHaveBeenCalledWith({ ...settings, providerId: 'archive' });
	expect(storageApi.saveSettings.mock.invocationCallOrder[0]).toBeLessThan(
		storageApi.backup.mock.invocationCallOrder[0]
	);
});

it('loads the saved selection and cancels a provider change without overwriting it', async () => {
	const user = userEvent.setup();
	storageApi.getSettings.mockResolvedValue({ ...settings, providerId: 'primary' });
	render(
		<MemoryRouter>
			<CloudPage />
		</MemoryRouter>
	);
	const disclosure = await screen.findByRole('button', { name: /^Storage provider/ });
	expect(disclosure).toHaveTextContent('Production files');
	await user.click(disclosure);
	const selector = screen.getByRole('combobox', { name: 'Storage provider' });
	expect(selector).toHaveTextContent('Production files');
	await user.click(selector);
	await user.click(await screen.findByRole('option', { name: 'Archive' }));
	await user.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
	expect(selector).toHaveTextContent('Production files');
	expect(storageApi.saveSettings).not.toHaveBeenCalled();
	await user.click(disclosure);
	expect(disclosure).toHaveAttribute('aria-expanded', 'false');
	expect(disclosure).toHaveTextContent('Production files');
});

it('offers storage configuration when no providers exist', async () => {
	const user = userEvent.setup();
	storageApi.listProviders.mockResolvedValue([]);
	render(
		<MemoryRouter>
			<CloudPage />
		</MemoryRouter>
	);
	await user.click(await screen.findByRole('button', { name: /^Storage provider/ }));
	expect(
		await screen.findByText('Add a storage provider before setting up backups.')
	).toBeInTheDocument();
	expect(screen.getByRole('combobox', { name: 'Storage provider' })).toBeDisabled();
	expect(screen.getByRole('button', { name: 'Back up now' })).toBeDisabled();
	expect(screen.getByRole('button', { name: 'Restore from cloud' })).toBeDisabled();
});

it('retries a failed provider load and restores the saved selection', async () => {
	const user = userEvent.setup();
	storageApi.getSettings.mockResolvedValue({ ...settings, providerId: 'primary' });
	storageApi.listProviders.mockRejectedValueOnce(new Error('Could not open storage credentials'));
	render(
		<MemoryRouter>
			<CloudPage />
		</MemoryRouter>
	);
	expect(await screen.findByRole('alert')).toHaveTextContent('Could not load storage settings.');
	expect(screen.getByRole('button', { name: 'Back up now' })).toBeDisabled();
	await user.click(screen.getByRole('button', { name: 'Try Again' }));
	await waitFor(() => expect(screen.getByRole('button', { name: 'Back up now' })).toBeEnabled());
	await user.click(screen.getByRole('button', { name: /^Storage provider/ }));
	expect(screen.getByRole('combobox', { name: 'Storage provider' })).toHaveTextContent(
		'Production files'
	);
});

it('keeps a failed settings save editable and does not start a backup', async () => {
	const user = userEvent.setup();
	storageApi.getSettings.mockResolvedValue({ ...settings, providerId: 'primary' });
	storageApi.saveSettings.mockRejectedValueOnce(new Error('Unable to save'));
	render(
		<MemoryRouter>
			<CloudPage />
		</MemoryRouter>
	);
	await user.click(await screen.findByRole('button', { name: 'Back up now' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Could not save backup settings.');
	expect(storageApi.backup).not.toHaveBeenCalled();
	await user.click(screen.getByRole('button', { name: /^Storage provider/ }));
	expect(screen.getByRole('combobox', { name: 'Storage provider' })).toBeEnabled();
});
