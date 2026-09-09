import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import StoragePage from '../../../src/renderer/src/pages/settings/pages/storage/Page';
import type { StorageOperationStatus } from '../../../src/shared/storage_types';

jest.mock('react-i18next', () => {
	const translations: Record<string, string> = {
		'common.signIn': 'Sign in',
		'common.tryAgain': 'Try Again',
		'settings.storage.configurationTitle': 'Cloud Backup',
		'settings.storage.description': 'Choose folders to back up securely.',
		'settings.storage.provider.title': 'Storage',
		'settings.storage.provider.description':
			'Choose which configured storage provider receives your backups and supplies files when you restore them.',
		'settings.storage.provider.placeholder': 'Select storage provider',
		'settings.storage.cancel': 'Cancel',
		'settings.storage.sync.title': 'Cloud Backup',
		'settings.storage.sync.description': 'Back up selected folders on a schedule',
		'settings.storage.sync.addFolders': 'Add folders',
		'settings.storage.sync.folder': 'Selected folder',
		'settings.storage.sync.removeFolder': 'Remove folder',
		'settings.storage.sync.save': 'Save schedule',
		'settings.storage.syncSaved': 'Schedule saved',
		'settings.storage.autoSync.interval': 'Backup interval',
		'settings.storage.autoSync.description': 'Run on schedule',
		'settings.storage.autoSync.off': 'Off',
		'settings.storage.autoSync.every1d': 'Every day',
		'settings.storage.autoSync.cronExpression': 'Cron expression',
		'settings.storage.autoSync.cronDescription': 'Five-field cron expression',
		'settings.storage.folders.agent': 'Agent',
		'settings.storage.backup': 'Back up now',
		'settings.storage.restore': 'Restore from cloud',
		'settings.storage.restoreDialog.title': 'Restore selected data?',
		'settings.storage.restoreDialog.description': 'Matching local files will be overwritten.',
		'settings.storage.restoreDialog.confirm': 'Restore selected data',
		'settings.storage.operation.backup.running': 'Backup is running in the background…',
		'settings.storage.operation.backup.succeeded': 'Backup completed',
		'settings.storage.operation.backup.partial': 'Backed up files; some failed',
		'settings.storage.errors.load': 'Could not load cloud backup settings.',
		'settings.storage.errors.pickFolders': 'Could not select folders.',
		'settings.storage.errors.saveSync': 'Could not save the cloud backup schedule.',
		'settings.storage.errors.push': 'Could not back up files.',
		'settings.storage.errors.pull': 'Could not restore files.',
	};
	const t = (key: string): string => translations[key] ?? key;
	return { useTranslation: () => ({ t }) };
});

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

let operationListener: ((status: StorageOperationStatus) => void) | undefined;
const unsubscribeOperationStatus = jest.fn();
const settings = {
	providerId: 'primary',
	paths: [] as string[],
	syncEnabled: false,
	syncCronExpression: '0 3 * * *',
};

beforeEach(() => {
	jest.clearAllMocks();
	operationListener = undefined;
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'storage', { configurable: true, value: storageApi });
	storageApi.listProviders.mockResolvedValue([
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
			accessKeyId: 'test-archive-access',
			hasSecretAccessKey: true,
			forcePathStyle: false,
		},
	]);
	storageApi.getSettings.mockResolvedValue(settings);
	storageApi.saveSettings.mockImplementation(async (value) => value);
	storageApi.syncFolders.mockResolvedValue([]);
	storageApi.pickFolders.mockResolvedValue([]);
	storageApi.getOperationStatus.mockResolvedValue(undefined);
	storageApi.onOperationStatusChanged.mockImplementation((listener) => {
		operationListener = listener;
		return unsubscribeOperationStatus;
	});
	storageApi.backup.mockResolvedValue({
		operationId: 'backup-1',
		operation: 'backup',
		trigger: 'manual',
		state: 'running',
		startedAt: '2026-08-20T10:00:00.000Z',
		transferred: 0,
		skipped: 0,
		failed: 0,
		revision: 1,
	});
	storageApi.restore.mockResolvedValue({
		operationId: 'restore-1',
		operation: 'restore',
		trigger: 'manual',
		state: 'running',
		startedAt: '2026-08-20T10:00:00.000Z',
		transferred: 0,
		skipped: 0,
		failed: 0,
		revision: 3,
	});
});

it('saves folders and a custom schedule with the selected storage provider', async () => {
	const user = userEvent.setup();
	storageApi.syncFolders.mockResolvedValue([{ key: 'agent', path: '/data/agent' }]);
	render(
		<MemoryRouter>
			<StoragePage />
		</MemoryRouter>
	);

	await user.click(await screen.findByRole('combobox', { name: 'Storage' }));
	await user.click(await screen.findByRole('option', { name: 'Archive' }));
	await user.click(await screen.findByRole('switch', { name: 'Agent' }));
	await user.click(screen.getByRole('combobox', { name: 'Backup interval' }));
	await user.click(await screen.findByRole('option', { name: 'Every day' }));
	await user.clear(screen.getByLabelText('Cron expression'));
	await user.type(screen.getByLabelText('Cron expression'), '0 4 * * *');
	await user.click(screen.getByRole('button', { name: 'Save schedule' }));

	await waitFor(() =>
		expect(storageApi.saveSettings).toHaveBeenCalledWith({
			providerId: 'archive',
			paths: ['/data/agent'],
			syncEnabled: true,
			syncCronExpression: '0 4 * * *',
		})
	);
	expect(
		screen.getByText(
			'Choose which configured storage provider receives your backups and supplies files when you restore them.'
		)
	).toBeInTheDocument();
});

it('backs up directly and confirms before restoring matching local files', async () => {
	const user = userEvent.setup();
	storageApi.getSettings.mockResolvedValue({ ...settings, paths: ['/data/agent'] });
	render(
		<MemoryRouter>
			<StoragePage />
		</MemoryRouter>
	);

	await user.click(await screen.findByRole('button', { name: 'Back up now' }));
	await waitFor(() => expect(storageApi.backup).toHaveBeenCalledWith());
	act(() => {
		operationListener?.({
			operationId: 'backup-1',
			operation: 'backup',
			trigger: 'manual',
			state: 'succeeded',
			startedAt: '2026-08-20T10:00:00.000Z',
			finishedAt: '2026-08-20T10:01:00.000Z',
			transferred: 1,
			skipped: 0,
			failed: 0,
			revision: 2,
		});
	});

	await user.click(screen.getByRole('button', { name: 'Restore from cloud' }));
	expect(screen.getByRole('dialog')).toHaveTextContent('Matching local files will be overwritten.');
	await user.click(screen.getByRole('button', { name: 'Restore selected data' }));
	await waitFor(() => expect(storageApi.restore).toHaveBeenCalledWith());
});

it('rehydrates a running backup after the page remounts', async () => {
	const user = userEvent.setup();
	storageApi.getSettings.mockResolvedValue({ ...settings, paths: ['/data/agent'] });
	storageApi.getOperationStatus.mockResolvedValue({
		operationId: 'backup-1',
		operation: 'backup',
		trigger: 'manual',
		state: 'running',
		startedAt: '2026-08-20T10:00:00.000Z',
		transferred: 0,
		skipped: 0,
		failed: 0,
		revision: 1,
	});

	const unsubscribeCount = unsubscribeOperationStatus.mock.calls.length;
	const first = render(
		<MemoryRouter>
			<StoragePage />
		</MemoryRouter>
	);
	expect(await screen.findByText('Backup is running in the background…')).toBeInTheDocument();
	expect(screen.getByRole('combobox', { name: 'Storage' })).toBeDisabled();
	first.unmount();
	expect(unsubscribeOperationStatus).toHaveBeenCalledTimes(unsubscribeCount + 1);
});

it('keeps a newer completion event when the initial snapshot resolves late', async () => {
	let resolveStatus: ((status: StorageOperationStatus | undefined) => void) | undefined;
	storageApi.getSettings.mockResolvedValue({ ...settings, paths: ['/data/agent'] });
	storageApi.getOperationStatus.mockReturnValue(
		new Promise((resolve) => {
			resolveStatus = resolve;
		})
	);
	render(
		<MemoryRouter>
			<StoragePage />
		</MemoryRouter>
	);
	await waitFor(() => expect(storageApi.onOperationStatusChanged).toHaveBeenCalled());
	act(() => {
		operationListener?.({
			operationId: 'backup-1',
			operation: 'backup',
			trigger: 'manual',
			state: 'succeeded',
			startedAt: '2026-08-20T10:00:00.000Z',
			finishedAt: '2026-08-20T10:01:00.000Z',
			transferred: 2,
			skipped: 0,
			failed: 0,
			revision: 2,
		});
	});
	await act(async () => {
		resolveStatus?.({
			operationId: 'backup-1',
			operation: 'backup',
			trigger: 'manual',
			state: 'running',
			startedAt: '2026-08-20T10:00:00.000Z',
			transferred: 0,
			skipped: 0,
			failed: 0,
			revision: 1,
		});
	});

	expect(await screen.findByText('Backup completed')).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Back up now' })).toBeEnabled();
});

it('preserves loaded settings when an auxiliary load fails', async () => {
	storageApi.getSettings.mockResolvedValue({ ...settings, paths: ['/data/agent'] });
	storageApi.syncFolders.mockRejectedValue(new Error('folder discovery failed'));
	render(
		<MemoryRouter>
			<StoragePage />
		</MemoryRouter>
	);

	expect(await screen.findByText('/data/agent')).toBeInTheDocument();
	expect(screen.getByRole('alert')).toHaveTextContent('Could not load cloud backup settings.');
	expect(screen.getByRole('button', { name: 'Back up now' })).toBeEnabled();
});

it('shows a retry without editable defaults when settings cannot be loaded', async () => {
	storageApi.getSettings.mockRejectedValue(new Error('settings unavailable'));
	const { container } = render(
		<MemoryRouter>
			<StoragePage />
		</MemoryRouter>
	);

	expect(await screen.findByRole('alert')).toHaveTextContent(
		'Could not load cloud backup settings.'
	);
	expect(screen.getByRole('button', { name: 'Try Again' })).toBeEnabled();
	expect(screen.queryByRole('button', { name: 'Back up now' })).not.toBeInTheDocument();
	expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
});

it.each([undefined, 'deleted'])(
	'disables backup until an available provider is selected (%s)',
	async (providerId) => {
		storageApi.getSettings.mockResolvedValue({ ...settings, providerId, paths: ['/data/agent'] });
		render(
			<MemoryRouter>
				<StoragePage />
			</MemoryRouter>
		);
		expect(await screen.findByRole('button', { name: 'Back up now' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Restore from cloud' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Add folders' })).toBeDisabled();
		expect(screen.getByRole('combobox', { name: 'Storage' })).toBeEnabled();
		expect(screen.queryByRole('link', { name: 'Manage storage' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
	}
);

it('keeps a newer completion event when the backup command resolves late', async () => {
	const user = userEvent.setup();
	let resolveBackup: ((status: StorageOperationStatus) => void) | undefined;
	storageApi.getSettings.mockResolvedValue({ ...settings, paths: ['/data/agent'] });
	storageApi.backup.mockReturnValue(
		new Promise((resolve) => {
			resolveBackup = resolve;
		})
	);
	render(
		<MemoryRouter>
			<StoragePage />
		</MemoryRouter>
	);

	await user.click(await screen.findByRole('button', { name: 'Back up now' }));
	await waitFor(() => expect(storageApi.backup).toHaveBeenCalledWith());
	act(() => {
		operationListener?.({
			operationId: 'backup-1',
			operation: 'backup',
			trigger: 'manual',
			state: 'succeeded',
			startedAt: '2026-08-20T10:00:00.000Z',
			finishedAt: '2026-08-20T10:01:00.000Z',
			transferred: 2,
			skipped: 0,
			failed: 0,
			revision: 2,
		});
	});
	await act(async () => {
		resolveBackup?.({
			operationId: 'backup-1',
			operation: 'backup',
			trigger: 'manual',
			state: 'running',
			startedAt: '2026-08-20T10:00:00.000Z',
			transferred: 0,
			skipped: 0,
			failed: 0,
			revision: 1,
		});
	});

	expect(await screen.findByText('Backup completed')).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Back up now' })).toBeEnabled();
});

it('announces partial backups as warnings', async () => {
	storageApi.getSettings.mockResolvedValue({ ...settings, paths: ['/data/agent'] });
	render(
		<MemoryRouter>
			<StoragePage />
		</MemoryRouter>
	);
	await waitFor(() => expect(storageApi.onOperationStatusChanged).toHaveBeenCalled());

	act(() => {
		operationListener?.({
			operationId: 'backup-1',
			operation: 'backup',
			trigger: 'manual',
			state: 'partial',
			startedAt: '2026-08-20T10:00:00.000Z',
			finishedAt: '2026-08-20T10:01:00.000Z',
			transferred: 2,
			skipped: 0,
			failed: 1,
			revision: 2,
		});
	});

	const warning = await screen.findByRole('alert');
	expect(warning).toHaveTextContent('Backed up files; some failed');
	expect(warning.firstElementChild).toHaveClass('text-amber-700');
});
