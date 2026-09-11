import { render, screen } from '@testing-library/react';
import { AppShell } from '../../../src/renderer/src/components/app/titlebar/AppShell';

jest.mock('../../../src/renderer/src/components/app/titlebar/hooks/useAppTheme', () => ({
	useAppTheme: jest.fn(),
}));

jest.mock('../../../src/renderer/src/components/app/titlebar/AppTitleBar', () => ({
	AppTitleBar: () => <div data-testid="app-titlebar" />,
}));

it('paints the transparent window-control layer over the app surface', () => {
	render(<AppShell />);

	const shell = screen.getByTestId('app-titlebar').parentElement;
	expect(shell).toHaveClass(
		'app-translucent-window',
		'h-full',
		'overflow-hidden',
		'bg-background',
		'text-foreground'
	);
});
