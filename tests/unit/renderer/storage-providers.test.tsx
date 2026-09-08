import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StorageProvidersPage from '../../../src/renderer/src/pages/settings/pages/providers/storage/Page';
import type { StorageProvider, StorageProviderInput } from '../../../src/shared/storage_types';

jest.mock('react-i18next', () => {
	const translations = require('../../../resources/i18n/en/main.json');
	const t = (key: string, options?: Record<string, string>): string => {
		const value =
			key.split('.').reduce((entry: any, part: string) => entry?.[part], translations) ?? key;
		return String(value).replace(/\{\{(\w+)\}\}/g, (_, name) => options?.[name] ?? '');
	};
	return { useTranslation: () => ({ t }) };
});

const first: StorageProvider = {
	id: 'first',
	name: 'Production',
	bucket: 'production-files',
	region: 'us-east-1',
	endpoint: '',
	accessKeyId: 'test-access-id',
	hasSecretAccessKey: true,
	forcePathStyle: false,
};
const second: StorageProvider = {
	...first,
	id: 'second',
	name: 'Archive',
	bucket: 'archive-files',
};
const api = { listProviders: jest.fn(), saveProvider: jest.fn(), removeProvider: jest.fn() };

beforeEach(() => {
	Object.defineProperty(window, 'storage', { configurable: true, value: api });
	api.listProviders.mockResolvedValue([]);
	api.saveProvider.mockImplementation(async (input: StorageProviderInput) => {
		const { secretAccessKey: _secret, ...provider } = input;
		return { ...provider, id: provider.id ?? 'created', hasSecretAccessKey: true };
	});
	api.removeProvider.mockResolvedValue(true);
});

it('adds multiple independent S3 connections and retains existing entries', async () => {
	const user = userEvent.setup();
	render(<StorageProvidersPage />);
	await screen.findByText('No storage connections');
	for (const name of ['Production', 'Archive']) {
		await user.click(screen.getByRole('button', { name: 'Add storage' }));
		const dialog = within(screen.getByRole('dialog'));
		expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
		await user.type(dialog.getByLabelText('Name'), name);
		await user.type(dialog.getByLabelText('Bucket'), name.toLowerCase() + '-files');
		await user.type(dialog.getByLabelText('Access key ID'), 'test-access');
		await user.type(dialog.getByLabelText('Secret access key'), 'test-secret');
		api.saveProvider.mockResolvedValueOnce(name === 'Production' ? first : second);
		await user.click(dialog.getByRole('button', { name: 'Save', exact: true }));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	}
	expect(screen.getByText('Production')).toBeInTheDocument();
	expect(screen.getByText('Archive')).toBeInTheDocument();
	expect(api.saveProvider).toHaveBeenNthCalledWith(
		2,
		expect.objectContaining({
			id: undefined,
			name: 'Archive',
			bucket: 'archive-files',
			endpoint: '',
			region: 'us-east-1',
			secretAccessKey: 'test-secret',
			forcePathStyle: false,
		})
	);
});

it('edits one connection without requiring or displaying its saved secret', async () => {
	const user = userEvent.setup();
	api.listProviders.mockResolvedValue([first, second]);
	render(<StorageProvidersPage />);
	await user.click(await screen.findByRole('button', { name: 'Edit Production' }));
	const dialog = within(screen.getByRole('dialog'));
	expect(dialog.getByLabelText('Secret access key')).toHaveValue('');
	expect(dialog.getByLabelText('Secret access key')).not.toBeRequired();
	await user.clear(dialog.getByLabelText('Name'));
	await user.type(dialog.getByLabelText('Name'), 'Updated production');
	await user.type(dialog.getByLabelText('Endpoint URL'), 'http://localhost:9000');
	await user.click(dialog.getByRole('switch', { name: 'Use path-style addressing' }));
	await user.click(dialog.getByRole('button', { name: 'Save', exact: true }));
	await screen.findByText('Updated production');
	expect(screen.getByText('Archive')).toBeInTheDocument();
	expect(api.saveProvider).toHaveBeenCalledWith(
		expect.objectContaining({
			id: 'first',
			name: 'Updated production',
			secretAccessKey: '',
			endpoint: 'http://localhost:9000',
			forcePathStyle: true,
		})
	);
});

it('removes only the selected connection and preserves it if removal fails', async () => {
	const user = userEvent.setup();
	api.listProviders.mockResolvedValue([first, second]);
	api.removeProvider.mockRejectedValueOnce(new Error('Could not remove connection.'));
	render(<StorageProvidersPage />);
	await user.click(await screen.findByRole('button', { name: 'Remove Production' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Could not remove connection.');
	expect(screen.getByText('Production')).toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: 'Remove Production' }));
	await waitFor(() => expect(screen.queryByText('Production')).not.toBeInTheDocument());
	expect(screen.getByText('Archive')).toBeInTheDocument();
	expect(api.removeProvider).toHaveBeenLastCalledWith('first');
});

it('keeps the draft when saving fails and allows cancelling without saving', async () => {
	const user = userEvent.setup();
	api.listProviders.mockResolvedValue([first]);
	api.saveProvider.mockRejectedValueOnce(new Error('Secure storage unavailable.'));
	render(<StorageProvidersPage />);
	await user.click(await screen.findByRole('button', { name: 'Edit Production' }));
	await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Secure storage unavailable.');
	expect(screen.getByLabelText('Name')).toHaveValue('Production');
	await user.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
	await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	expect(api.saveProvider).toHaveBeenCalledTimes(1);
});

it('shows loading and load errors without a false empty state', async () => {
	api.listProviders.mockRejectedValueOnce(new Error('Could not open saved connections.'));
	render(<StorageProvidersPage />);
	expect(screen.getByRole('button', { name: 'Add storage' })).toBeDisabled();
	expect(await screen.findByRole('alert')).toHaveTextContent('Could not open saved connections.');
	expect(screen.queryByText('No storage connections')).not.toBeInTheDocument();
});
