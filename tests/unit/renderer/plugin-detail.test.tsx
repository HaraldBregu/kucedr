import { render, screen } from '@testing-library/react';
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
])('shows the %s plugin details', (path, name, description, endpoint) => {
	render(
		<MemoryRouter initialEntries={[`/settings/plugins/${path}`]}>
			<Routes>
				<Route path="/settings/plugins/:kind/:providerId/:entryId" element={<PluginDetailPage />} />
			</Routes>
		</MemoryRouter>
	);
	expect(screen.getByRole('heading', { name })).toBeInTheDocument();
	expect(screen.getByText(description)).toBeInTheDocument();
	expect(screen.getByText(endpoint)).toBeInTheDocument();
	expect(screen.getByText('settings.integrations.authentication')).toBeInTheDocument();
	expect(document.querySelector('.size-16')).toBeInTheDocument();
});
