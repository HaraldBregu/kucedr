import { fireEvent, render, screen } from '@testing-library/react';
import { AppNavigationBar } from '../../../src/renderer/src/components/app/navigationbar/AppNavigationBar';

jest.mock(
	'../../../src/renderer/src/components/app/navigationbar/hooks/useAppWindowState',
	() => ({ useAppWindowState: jest.fn(() => false) })
);

beforeEach(() => {
	Object.defineProperty(window, 'win', {
		configurable: true,
		value: {
			clickNavigationBarButton: jest.fn(),
			minimize: jest.fn(),
			maximize: jest.fn(),
			close: jest.fn(),
			popupMenu: jest.fn(),
		},
	});
});

it('uses the shared solid navigation bar without a title', () => {
	const { container } = render(<AppNavigationBar />);
	const navigationBar = container.querySelector('[data-slot="navigationbar"]');

	expect(navigationBar).toHaveClass('bg-background');
	expect(navigationBar).not.toHaveTextContent('Workspace');
});

it('relays app button clicks without showing the expanded toggle as selected', () => {
	render(
		<AppNavigationBar
			leftButtons={[
				{
					id: 'toggle-sidebar',
					label: 'Collapse sidebar',
					icon: 'panel-left',
					expanded: true,
				},
			]}
		/>
	);

	const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
	expect(toggle).toHaveAttribute('aria-expanded', 'true');
	expect(toggle).toHaveClass('aria-expanded:bg-transparent');
	fireEvent.click(toggle);
	expect(window.win.clickNavigationBarButton).toHaveBeenCalledWith('toggle-sidebar');
});
