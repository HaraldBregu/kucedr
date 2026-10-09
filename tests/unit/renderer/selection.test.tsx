import { render, screen, waitFor } from '@testing-library/react';
import { useSelection } from '../../../src/renderer/src/hooks/selection';

it('restores selection on every open while the content stays mounted', async () => {
	const scrollIntoView = jest.fn();
	Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
	function Content({ open, selected }: { open: boolean; selected: string }): React.JSX.Element {
		const ref = useSelection(null);
		return <div ref={ref} data-state={open ? 'open' : 'closed'}><button aria-current={selected === 'A' ? 'page' : undefined}>A</button><button aria-current={selected === 'B' ? 'page' : undefined}>B</button></div>;
	}
	const { rerender } = render(<Content open selected="A" />);
	await waitFor(() => expect(screen.getByRole('button', { name: 'A' })).toHaveFocus());
	rerender(<Content open={false} selected="B" />);
	screen.getByRole('button', { name: 'A' }).blur();
	await waitFor(() => expect(screen.getByRole('button', { name: 'B' })).not.toHaveFocus());
	rerender(<Content open selected="B" />);
	const selected = screen.getByRole('button', { name: 'B' });
	await waitFor(() => expect(selected).toHaveFocus());
	expect(scrollIntoView.mock.contexts).toContain(selected);
});
