import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PluginDetailPage from '../../../src/renderer/src/pages/settings/pages/plugins/Detail';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { type?: string }) =>
			options?.type ? `${key}: ${options.type}` : key,
	}),
}));

jest.mock('../../../src/renderer/src/lib/providers', () => ({
	mcps: () => [
		{
			id: 'gmail',
			name: 'Gmail',
			description: 'Read and manage Gmail',
			type: 'mcp',
			authentication: 'oauth2',
			url: 'https://gmail.example/mcp',
			provider: {
				id: 'google',
				name: 'Google',
				baseUrl: '',
				iconDarkUrl: 'google.svg',
				iconLightUrl: 'google.svg',
			},
		},
	],
	databases: () => [
		{
			id: 'pinecone',
			name: 'Pinecone Vector Database',
			description: 'Store vector embeddings.',
			type: 'vector',
			authentication: 'api-key',
			url: 'https://api.pinecone.io',
			provider: { id: 'pinecone', name: 'Pinecone', baseUrl: '' },
		},
	],
	storages: () => [
		{
			id: 'cloudflare-r2',
			name: 'Cloudflare R2',
			description: 'Store files in R2.',
			authentication: 's3-access-key',
			metadata: {
				protocol: 's3',
				region: 'auto',
				endpointTemplate: 'https://{accountId}.r2.cloudflarestorage.com',
			},
			provider: { id: 'cloudflare', name: 'Cloudflare', baseUrl: '' },
		},
	],
}));

const mcpApi = {
	list: jest.fn(),
	delete: jest.fn(),
};
const providerApi = {
	listEnabledPlugins: jest.fn(),
	setPluginEnabled: jest.fn(),
};

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'mcp', { configurable: true, value: mcpApi });
	Object.defineProperty(window, 'provider', { configurable: true, value: providerApi });
	mcpApi.list.mockResolvedValue({
		gmail: { type: 'http', name: 'Gmail', url: 'https://gmail.example/mcp', enabled: true },
	});
	mcpApi.delete.mockResolvedValue(undefined);
	providerApi.listEnabledPlugins.mockResolvedValue({
		database: ['pinecone/pinecone'],
		storage: ['cloudflare/cloudflare-r2'],
	});
	providerApi.setPluginEnabled.mockResolvedValue({ database: [], storage: [] });
});

function renderDetail(path: string): void {
	render(
		<MemoryRouter initialEntries={[`/settings/plugins/${path}`]}>
			<Routes>
				<Route path="/settings/plugins/:kind/:providerId/:entryId" element={<PluginDetailPage />} />
			</Routes>
		</MemoryRouter>
	);
}

it.each([
	['mcp/google/gmail', 'Gmail', 'Read and manage Gmail', 'https://gmail.example/mcp'],
	[
		'database/pinecone/pinecone',
		'Pinecone Vector Database',
		'Store vector embeddings.',
		'https://api.pinecone.io',
	],
	[
		'storage/cloudflare/cloudflare-r2',
		'Cloudflare R2',
		'Store files in R2.',
		'https://{accountId}.r2.cloudflarestorage.com',
	],
])('shows the %s plugin details', async (path, name, description, endpoint) => {
	renderDetail(path);
	expect(screen.getByRole('heading', { name })).toBeInTheDocument();
	expect(screen.getByText(description)).toBeInTheDocument();
	expect(screen.getByText(endpoint)).toBeInTheDocument();
	expect(screen.getByText('settings.integrations.authentication')).toBeInTheDocument();
	expect(document.querySelector('.size-16')).toBeInTheDocument();
	expect(await screen.findByRole('button', { name: 'settings.integrations.remove' })).toBeInTheDocument();
});

it('confirms before removing an MCP plugin from its detail page', async () => {
	const user = userEvent.setup();
	renderDetail('mcp/google/gmail');

	await user.click(await screen.findByRole('button', { name: 'settings.integrations.remove' }));
	expect(mcpApi.delete).not.toHaveBeenCalled();
	await user.click(screen.getByRole('button', { name: 'settings.integrations.confirmRemove' }));

	await waitFor(() => expect(mcpApi.delete).toHaveBeenCalledWith('gmail'));
	expect(screen.queryByRole('button', { name: 'settings.integrations.remove' })).not.toBeInTheDocument();
});

it('confirms before removing a provider plugin from its detail page', async () => {
	const user = userEvent.setup();
	renderDetail('storage/cloudflare/cloudflare-r2');

	await user.click(await screen.findByRole('button', { name: 'settings.integrations.remove' }));
	expect(providerApi.setPluginEnabled).not.toHaveBeenCalled();
	await user.click(screen.getByRole('button', { name: 'settings.integrations.confirmRemove' }));

	await waitFor(() =>
		expect(providerApi.setPluginEnabled).toHaveBeenCalledWith(
			'storage',
			'cloudflare/cloudflare-r2',
			false
		)
	);
});
