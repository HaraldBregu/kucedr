import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '../../../src/renderer/src/pages/settings/Layout';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

jest.mock('../../../src/renderer/src/lib/providers', () => ({
	mcps: () => [{ id: 'gmail', name: 'Gmail', provider: { id: 'google' } }],
	databases: () => [
		{ id: 'pinecone', name: 'Pinecone Vector Database', provider: { id: 'pinecone' } },
	],
	storages: () => [{ id: 'cloudflare-r2', name: 'Cloudflare R2', provider: { id: 'cloudflare' } }],
}));

beforeEach(() => {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: jest.fn((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: jest.fn(),
			removeListener: jest.fn(),
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			dispatchEvent: jest.fn(),
		})),
	});
});

it.each([
	['mcp/google/gmail', 'Gmail'],
	['database/pinecone/pinecone', 'Pinecone Vector Database'],
	['storage/cloudflare/cloudflare-r2', 'Cloudflare R2'],
])('shows Plugins and the %s detail name in the breadcrumb', async (path, name) => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={[`/settings/plugins/${path}`]}>
			<Routes>
				<Route path="/settings" element={<Layout />}>
					<Route path="plugins" element={<p>Plugins list</p>} />
					<Route path="plugins/:kind/:providerId/:entryId" element={<p>Plugin detail</p>} />
				</Route>
			</Routes>
		</MemoryRouter>
	);
	const breadcrumb = screen.getByRole('navigation', { name: 'settings.breadcrumb.label' });
	expect(within(breadcrumb).getByText(name)).toBeInTheDocument();
	await user.click(within(breadcrumb).getByRole('link', { name: 'settings.tabs.plugins' }));
	expect(await screen.findByText('Plugins list')).toBeInTheDocument();
});
