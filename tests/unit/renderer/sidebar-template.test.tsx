import { fireEvent, render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PageContainer, Split } from '../../../src/renderer/src/components/app/base/page';

jest.mock('@/contexts', () => ({
	useApp: () => ({ theme: 'dark', setTheme: jest.fn() }),
}));

jest.mock('@/components/app/navigationbar/hooks/useWindowState', () => ({
	useWindowState: () => ({ isFullScreen: false, isMaximized: false }),
}));

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

beforeEach(() => {
	window.localStorage.clear();
	document.cookie = 'page_sidebar_layout_state=; path=/; max-age=0';
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: jest.fn((query: string) => ({
			matches: false,
			media: query,
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
		})),
	});
});

it('renders the page header inside the content pane beside a full-height sidebar', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/home']}>
			<PageContainer>
				<Split sidebar={<button>Stored chat</button>}><div>Conversation</div></Split>
			</PageContainer>
		</MemoryRouter>
	);
	const split = container.querySelector('[data-slot="split-pane"]') as HTMLElement;
	const sidebar = within(split).getByRole('complementary');
	const content = within(split).getByRole('main');
	const header = container.querySelector('[data-slot="navigationbar"]');

	expect(container.querySelectorAll('[data-slot="navigationbar"]')).toHaveLength(1);
	expect(content).toContainElement(header as HTMLElement);
	expect(header).not.toHaveClass('fixed');
	expect(sidebar).not.toHaveClass('fixed', 'top-12', 'pt-12');
	expect(within(sidebar).getByText('Kucedr')).toBeInTheDocument();
	expect(within(sidebar).getByRole('button', { name: 'Toggle Sidebar' })).toHaveAttribute('aria-expanded', 'true');
});

it('moves the toggle into the page header and excludes the collapsed sidebar from focus', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/home']}>
			<PageContainer>
				<Split sidebar={<button>Stored chat</button>}><div>Conversation</div></Split>
			</PageContainer>
		</MemoryRouter>
	);
	const sidebar = container.querySelector('[data-slot="split-pane-sidebar"]') as HTMLElement;
	fireEvent.click(within(sidebar).getByRole('button', { name: 'Toggle Sidebar' }));
	const content = container.querySelector('[data-slot="split-pane-content"]') as HTMLElement;

	expect(sidebar).toHaveAttribute('inert');
	expect(sidebar).toHaveAttribute('data-state', 'collapsed');
	expect(within(content).getByRole('button', { name: 'Toggle Sidebar' })).toHaveAttribute('aria-expanded', 'false');
	fireEvent.click(within(content).getByRole('button', { name: 'Toggle Sidebar' }));
	expect(sidebar).not.toHaveAttribute('inert');
	expect(sidebar).toHaveAttribute('data-state', 'expanded');
});

it('renders an initially collapsed sidebar without an expanded header phase', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/workspace']}>
			<PageContainer initialState={{ sidebarOpen: false }}>
				<Split sidebar={<button>Files</button>}><div>Workspace</div></Split>
			</PageContainer>
		</MemoryRouter>
	);
	const sidebar = container.querySelector('[data-slot="split-pane-sidebar"]');
	const content = container.querySelector('[data-slot="split-pane-content"]') as HTMLElement;

	expect(sidebar).toHaveAttribute('inert');
	expect(sidebar).toHaveAttribute('data-state', 'collapsed');
	expect(within(content).getByRole('button', { name: 'Toggle Sidebar' })).toHaveAttribute('aria-expanded', 'false');
	expect(content.querySelector('[data-slot="navigationbar"]')).toBeInTheDocument();
});
