import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Restore from '../../../src/renderer/src/pages/settings/pages/storage/Restore';
import mockTranslations from '../../../resources/i18n/en/main.json';

jest.mock('react-i18next', () => {
	const t = (key: string): string => {
		let value: unknown = mockTranslations;
		for (const part of key.split('.'))
			value =
				value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined;
		return String(value ?? key);
	};
	return { useTranslation: () => ({ t }) };
});

const api = { listSnapshots: jest.fn(), pickFolders: jest.fn() };
const onRestore = jest.fn();
const snapshot = {
	key: 'backups/old/manifest.json',
	folder: 'Documents',
	createdAt: '2026-10-01T12:00:00Z',
	files: 3,
	bytes: 120,
};

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'storage', { configurable: true, value: api });
	api.listSnapshots.mockResolvedValue([snapshot]);
	api.pickFolders.mockResolvedValue(['/new-computer/Documents']);
});

it('restores an earlier backup to a chosen folder on another computer without configured folders', async () => {
	const user = userEvent.setup();
	render(
		<Restore
			open
			disabled={false}
			versioned={false}
			hasFolders={false}
			onOpenChange={jest.fn()}
			onRestore={onRestore}
		/>
	);
	await waitFor(() =>
		expect(screen.getByRole('combobox', { name: 'Backup to restore' })).toBeEnabled()
	);
	expect(screen.getByRole('button', { name: 'Restore files' })).toBeDisabled();
	await user.click(screen.getByRole('combobox', { name: 'Backup to restore' }));
	await user.click(await screen.findByRole('option', { name: /^Documents/, hidden: true }));
	expect(screen.getByRole('button', { name: 'Restore files' })).toBeDisabled();
	await user.click(screen.getByRole('button', { name: 'Choose destination folder' }));
	await screen.findByText('/new-computer/Documents');
	await user.click(screen.getByRole('button', { name: 'Restore files' }));
	expect(onRestore).toHaveBeenCalledWith({
		snapshotKey: snapshot.key,
		path: '/new-computer/Documents',
	});
});

it('lets users retry a failed catalog load and retains latest-folder restore', async () => {
	const user = userEvent.setup();
	api.listSnapshots.mockRejectedValueOnce(new Error('Offline'));
	render(
		<Restore
			open
			disabled={false}
			versioned={false}
			hasFolders
			onOpenChange={jest.fn()}
			onRestore={onRestore}
		/>
	);
	expect(await screen.findByRole('alert')).toHaveTextContent('Could not load available backups.');
	await user.click(screen.getByRole('button', { name: 'Try Again' }));
	await waitFor(() => expect(api.listSnapshots).toHaveBeenCalledTimes(2));
	await user.click(screen.getByRole('button', { name: 'Restore files' }));
	expect(onRestore).toHaveBeenCalledWith(undefined);
});

it('keeps version sync independent of the backup catalog', async () => {
	const user = userEvent.setup();
	render(
		<Restore
			open
			disabled={false}
			versioned
			hasFolders
			onOpenChange={jest.fn()}
			onRestore={onRestore}
		/>
	);
	expect(api.listSnapshots).not.toHaveBeenCalled();
	expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: 'Fetch remote versions' }));
	expect(onRestore).toHaveBeenCalledWith(undefined);
});
