import { act, renderHook } from '@testing-library/react';
import { useMouseNavigation } from '../../../src/renderer/src/hooks/mouse';

const navigate = jest.fn();
jest.mock('../../../src/renderer/src/router', () => ({ router: { navigate: (...args: unknown[]) => navigate(...args) } }));

it('uses the mouse back and forward buttons for navigation on macOS', () => {
	Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' });
	const { unmount } = renderHook(() => useMouseNavigation());
	act(() => {
		window.dispatchEvent(new MouseEvent('mouseup', { button: 3 }));
		window.dispatchEvent(new MouseEvent('mouseup', { button: 4 }));
	});
	expect(navigate.mock.calls).toEqual([[-1], [1]]);
	unmount();
	window.dispatchEvent(new MouseEvent('mouseup', { button: 3 }));
	expect(navigate).toHaveBeenCalledTimes(2);
});
