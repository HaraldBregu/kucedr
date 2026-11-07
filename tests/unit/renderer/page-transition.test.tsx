import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PageTransition } from '../../../src/renderer/src/experience/PageTransition';

jest.mock('motion/react', () => ({
	motion: {
		div: ({
			children,
			variants,
		}: {
			children: ReactNode;
			variants: Record<string, { y?: number }>;
		}): React.JSX.Element => (
			<div data-testid="page-transition" data-initial-y={variants.initial.y}>
				{children}
			</div>
		),
	},
	useReducedMotion: (): boolean => false,
}));

it.each(['/home', '/settings/general'])(
	'keeps the split-pane shell stationary on %s',
	(pathname) => {
		render(
			<MemoryRouter initialEntries={[pathname]}>
				<PageTransition>Page</PageTransition>
			</MemoryRouter>
		);

		expect(screen.getByTestId('page-transition')).not.toHaveAttribute('data-initial-y');
	}
);

it('preserves vertical motion on routes without a split pane', () => {
	render(
		<MemoryRouter initialEntries={['/start']}>
			<PageTransition>Page</PageTransition>
		</MemoryRouter>
	);

	expect(screen.getByTestId('page-transition')).toHaveAttribute('data-initial-y', '5');
});
