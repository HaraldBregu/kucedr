import { render, screen } from '@testing-library/react';
import { AppTitleBar } from '../../../src/renderer/src/components/app/titlebar/AppTitleBar';

jest.mock(
	'../../../src/renderer/src/components/app/titlebar/hooks/useAppWindowState',
	() => ({ useAppWindowState: jest.fn(() => false) })
);

beforeEach(() => {
	Object.defineProperty(window, 'win', {
		configurable: true,
	value: {
			minimize: jest.fn(),
			maximize: jest.fn(),
			close: jest.fn(),
			popupMenu: jest.fn(),
		},
	});
});

it('renders transparent window chrome without app titlebar content', () => {
	const { container } = render(<AppTitleBar />);

	expect(container.querySelector('[data-slot="titlebar"]')).toHaveClass('bg-transparent');
	expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'Toggle project navigation' })).not.toBeInTheDocument();
});
