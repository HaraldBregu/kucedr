import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StorageProvidersPage from '../../../src/renderer/src/pages/settings/pages/providers/storage/Page';
import type { StorageProvider, StorageProviderInput } from '../../../src/shared/storage_types';
import mockTranslations from '../../../resources/i18n/en/main.json';

jest.mock('react-i18next', () => {
	const t = (key: string, options?: Record<string, string>): string => {
		let value: unknown = mockTranslations;
		for (const part of key.split('.')) {
			value =
				value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined;
		}
		return String(value ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => options?.[name] ?? '');
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
	jest.clearAllMocks();
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
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
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('form').closest('[data-slot="card"]')).toBeInTheDocument();
		const form = within(screen.getByRole('form'));
		expect(form.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
		await user.type(form.getByLabelText('Name'), name);
		await user.type(form.getByLabelText('Bucket'), name.toLowerCase() + '-files');
		await user.type(form.getByLabelText('Access key ID'), 'test-access');
		await user.type(form.getByLabelText('Secret access key'), 'test-secret');
		api.saveProvider.mockResolvedValueOnce(name === 'Production' ? first : second);
		await user.click(form.getByRole('button', { name: 'Save', exact: true }));
		await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
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
	const form = within(screen.getByRole('form'));
	expect(form.getByLabelText('Secret access key')).toHaveValue('');
	expect(form.getByLabelText('Secret access key')).not.toBeRequired();
	await user.clear(form.getByLabelText('Name'));
	await user.type(form.getByLabelText('Name'), 'Updated production');
	await user.type(form.getByLabelText('Endpoint URL'), 'http://localhost:9000');
	await user.click(form.getByRole('switch', { name: 'Use path-style addressing' }));
	await user.click(form.getByRole('button', { name: 'Save', exact: true }));
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
	await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
	expect(api.saveProvider).toHaveBeenCalledTimes(1);
});

it('shows loading and load errors without a false empty state', async () => {
	api.listProviders.mockRejectedValueOnce(new Error('Could not open saved connections.'));
	render(<StorageProvidersPage />);
	expect(screen.getByRole('button', { name: 'Add storage' })).toBeDisabled();
	expect(await screen.findByRole('alert')).toHaveTextContent('Could not open saved connections.');
	expect(screen.queryByText('No storage connections')).not.toBeInTheDocument();
});
