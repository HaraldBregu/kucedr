import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '../../../src/renderer/src/pages/settings/Layout';

jest.mock('react-i18next', () => ({
	initReactI18next: { type: '3rdParty', init: () => undefined },
	useTranslation: () => ({ t: (key: string): string => key }),
}));

jest.mock('../../../src/renderer/src/components/app/navigationbar/NavigationBar', () => ({
	NavigationBar: ({ contextContent }: { contextContent?: unknown }) => contextContent ?? null,
}));

it('treats an MCP detail route as a child of the MCP list breadcrumb', async () => {
	const user = userEvent.setup();
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
	render(
		<MemoryRouter initialEntries={['/settings/mcp/demo-server']}>
			<Routes>
				<Route path="/settings" element={<Layout />}>
					<Route path="mcp">
						<Route index element={<p>MCP list</p>} />
						<Route path=":mcpServerId" element={<p>MCP detail</p>} />
					</Route>
				</Route>
			</Routes>
		</MemoryRouter>
	);

	const breadcrumb = screen.getByRole('navigation', { name: 'settings.breadcrumb.label' });
	expect(within(breadcrumb).queryByRole('link', { name: 'settings.title' })).not.toBeInTheDocument();
	expect(within(breadcrumb).queryByText('settings.tabs.providers')).not.toBeInTheDocument();
	expect(within(breadcrumb).getByText('demo-server')).toBeInTheDocument();

	await user.click(within(breadcrumb).getByRole('link', { name: 'settings.tabs.mcp' }));
	expect(await screen.findByText('MCP list')).toBeInTheDocument();
});
