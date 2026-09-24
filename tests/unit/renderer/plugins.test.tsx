import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogService } from '../../../src/shared/provider_types';
import PluginsPage from '../../../src/renderer/src/pages/settings/pages/plugins/Page';

const navigate = jest.fn();

jest.mock('react-router-dom', () => ({
	useNavigate: () => navigate,
}));

const catalog = [
	'gmail',
	'google-calendar',
	'google-drive',
	'google-contacts',
	'google-docs',
	'google-sheets',
	'google-maps',
	'github',
	'gitlab',
	'microsoft-learn',
	'microsoft-mail',
	'microsoft-calendar',
	'microsoft-teams',
	'microsoft-onedrive',
	'microsoft-sharepoint',
	'microsoft-word',
	'microsoft-search',
	'notion',
].map(
	(id): CatalogService => ({
		id,
		name:
			id === 'microsoft-mail'
				? 'Outlook Mail'
				: id === 'microsoft-search'
					? 'Microsoft 365 Search'
					: id,
		description: `Use ${id}.`,
		type: 'mcp',
		url:
			id === 'microsoft-mail'
				? 'https://agent365.svc.cloud.microsoft/agents/tenants/{tenantId}/servers/mcp_MailTools'
				: id.startsWith('microsoft-') && id !== 'microsoft-learn'
					? `https://agent365.svc.cloud.microsoft/agents/tenants/{tenantId}/servers/${id}`
					: `https://${id}.example/mcp`,
		iconDarkUrl: `https://icons.example/${id}.png`,
		iconLightUrl: `https://icons.example/${id}.png`,
		provider: {
			id: [
				'gmail',
				'google-calendar',
				'google-drive',
				'google-contacts',
				'google-docs',
				'google-sheets',
				'google-maps',
			].includes(id)
				? 'google'
				: id.startsWith('microsoft-')
					? 'microsoft'
					: id,
			name: [
				'gmail',
				'google-calendar',
				'google-drive',
				'google-contacts',
				'google-docs',
				'google-sheets',
				'google-maps',
			].includes(id)
				? 'Google'
				: id,
			baseUrl: `https://${id}.example/mcp`,
		},
	})
);

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

jest.mock('../../../src/renderer/src/lib/providers', () => ({
	mcps: () => catalog,
	databases: () => [
		{
			id: 'pinecone',
			name: 'Pinecone Vector Database',
			description: 'Store and search vector embeddings in Pinecone.',
			type: 'vector',
			authentication: 'api-key',
			url: 'https://api.pinecone.io',
			provider: { id: 'pinecone', name: 'Pinecone', baseUrl: 'https://api.pinecone.io' },
		},
	],
	storages: () => [
		{
			id: 'supabase-storage',
			name: 'Supabase Storage',
			description: 'Store files in a Supabase Storage bucket through its S3 endpoint.',
			authentication: 's3-access-key',
			metadata: {
				protocol: 's3',
				endpointTemplate: 'https://{projectRef}.storage.supabase.co/storage/v1/s3',
			},
			provider: { id: 'supabase', name: 'Supabase', baseUrl: '' },
		},
		{
			id: 'cloudflare-r2',
			name: 'Cloudflare R2',
			description: 'Store files in a Cloudflare R2 bucket through its S3 endpoint.',
			authentication: 's3-access-key',
			metadata: {
				protocol: 's3',
				endpointTemplate: 'https://{accountId}.r2.cloudflarestorage.com',
			},
			provider: { id: 'cloudflare', name: 'Cloudflare', baseUrl: '' },
		},
	],
}));

const mcpApi = {
	list: jest.fn(),
	upsert: jest.fn(),
	delete: jest.fn(),
};

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'mcp', { configurable: true, value: mcpApi });
	mcpApi.list.mockResolvedValue({
		gmail: { type: 'http', name: 'gmail', url: 'https://gmail.example/mcp', enabled: true },
	});
	mcpApi.upsert.mockResolvedValue({});
	mcpApi.delete.mockResolvedValue(undefined);
});

it('renders the plugin providers with descriptions', async () => {
	const { container } = render(<PluginsPage />);

	expect(screen.getByRole('heading', { name: 'settings.integrations.title' })).toBeInTheDocument();
	await waitFor(() =>
		expect(
			screen.getByRole('button', { name: 'settings.integrations.options' })
		).toBeInTheDocument()
	);
	expect(screen.getAllByRole('button', { name: 'settings.integrations.add' })).toHaveLength(20);
	expect(container.querySelectorAll('[data-slot="item"]')).toHaveLength(21);
	expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(0);
	expect(screen.getByText('Use gmail.')).toBeInTheDocument();
	expect(screen.getByText('Outlook Mail')).toBeInTheDocument();
	expect(screen.getByText('Microsoft 365 Search')).toBeInTheDocument();
	expect(screen.getByText('Pinecone Vector Database')).toBeInTheDocument();
	expect(screen.getByText('Supabase Storage')).toBeInTheDocument();
	expect(screen.getByText('Cloudflare R2')).toBeInTheDocument();
	expect(
		container.querySelector('img[src="https://icons.example/google-drive.png"]')
	).toBeInTheDocument();
	expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
});

it('enables an integration without opening configuration UI', async () => {
	const user = userEvent.setup();
	render(<PluginsPage />);

	await screen.findByRole('button', { name: 'settings.integrations.options' });
	await user.click(screen.getAllByRole('button', { name: 'settings.integrations.add' })[16]);

	await waitFor(() =>
		expect(mcpApi.upsert).toHaveBeenCalledWith('notion', {
			type: 'http',
			name: 'notion',
			url: 'https://notion.example/mcp',
			enabled: true,
		})
	);
});

it('removes the MCP server from the added plugin menu', async () => {
	const user = userEvent.setup();
	render(<PluginsPage />);

	const gmailOptions = await screen.findByRole('button', { name: 'settings.integrations.options' });
	await user.click(gmailOptions);
	await user.click(screen.getByRole('menuitem', { name: 'settings.integrations.remove' }));

	await waitFor(() => expect(mcpApi.delete).toHaveBeenCalledWith('gmail'));
	expect(mcpApi.upsert).not.toHaveBeenCalled();
	expect(screen.getAllByRole('button', { name: 'settings.integrations.add' })).toHaveLength(21);
});

it('requires tenant configuration before adding a Microsoft 365 service', async () => {
	const user = userEvent.setup();
	render(<PluginsPage />);
	const row = screen.getByText('Outlook Mail').closest('[data-slot="item"]');
	expect(row).not.toBeNull();
	await user.click(within(row as HTMLElement).getByRole('button'));
	expect(mcpApi.upsert).not.toHaveBeenCalled();
	await user.type(
		screen.getByLabelText('settings.integrations.microsoft.tenantId'),
		'11111111-1111-1111-1111-111111111111'
	);
	await user.type(
		screen.getByLabelText('settings.integrations.microsoft.clientId'),
		'22222222-2222-2222-2222-222222222222'
	);
	await user.click(screen.getByRole('button', { name: 'settings.integrations.microsoft.add' }));
	await waitFor(() =>
		expect(mcpApi.upsert).toHaveBeenCalledWith('microsoft-mail', {
			type: 'http',
			name: 'Outlook Mail',
			url: 'https://agent365.svc.cloud.microsoft/agents/tenants/11111111-1111-1111-1111-111111111111/servers/mcp_MailTools',
			client_id: '22222222-2222-2222-2222-222222222222',
			enabled: true,
		})
	);
});

it('re-enables a configured Microsoft 365 service without replacing its tenant', async () => {
	const user = userEvent.setup();
	const saved = {
		type: 'http',
		name: 'Outlook Mail',
		url: 'https://agent365.svc.cloud.microsoft/agents/tenants/11111111-1111-1111-1111-111111111111/servers/mcp_MailTools',
		client_id: '22222222-2222-2222-2222-222222222222',
		enabled: false,
	};
	mcpApi.list.mockResolvedValue({ 'microsoft-mail': saved });
	render(<PluginsPage />);
	const row = screen.getByText('Outlook Mail').closest('[data-slot="item"]');
	expect(row).not.toBeNull();
	await user.click(within(row as HTMLElement).getByRole('button'));
	await waitFor(() =>
		expect(mcpApi.upsert).toHaveBeenCalledWith('microsoft-mail', { ...saved, enabled: true })
	);
	expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('opens plugin details from rows while keeping add buttons separate', async () => {
	const user = userEvent.setup();
	render(<PluginsPage />);
	await user.click(screen.getByText('Pinecone Vector Database'));
	expect(navigate).toHaveBeenLastCalledWith('/settings/plugins/database/pinecone/pinecone');
	await user.click(screen.getByText('Supabase Storage'));
	expect(navigate).toHaveBeenLastCalledWith('/settings/plugins/storage/supabase/supabase-storage');
	await user.click(screen.getByText('Use gitlab.'));
	expect(navigate).toHaveBeenLastCalledWith('/settings/plugins/mcp/gitlab/gitlab');
	const storageRow = screen.getByText('Cloudflare R2').closest('[data-slot="item"]');
	expect(storageRow).not.toBeNull();
	await user.click(within(storageRow as HTMLElement).getByRole('button'));
	expect(navigate).toHaveBeenLastCalledWith('/settings/providers/storage');
});
