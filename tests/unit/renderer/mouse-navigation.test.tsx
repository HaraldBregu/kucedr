import { renderHook } from '@testing-library/react';
import { useMouseNavigation } from '../../../src/renderer/src/hooks/mouse';
import { router } from '../../../src/renderer/src/router';

jest.mock('../../../src/renderer/src/router', () => ({
	router: { navigate: jest.fn() },
}));

const navigate = router.navigate as jest.Mock;

it('navigates route history with mouse back and forward buttons on macOS', () => {
	Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' });
	const { unmount } = renderHook(() => useMouseNavigation());

	window.dispatchEvent(new MouseEvent('mouseup', { button: 3 }));
	window.dispatchEvent(new MouseEvent('mouseup', { button: 4 }));

	expect(navigate).toHaveBeenNthCalledWith(1, -1);
	expect(navigate).toHaveBeenNthCalledWith(2, 1);
	unmount();
	window.dispatchEvent(new MouseEvent('mouseup', { button: 3 }));
	expect(navigate).toHaveBeenCalledTimes(2);
});

it('leaves Windows and Linux mouse commands to Electron', () => {
	Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
	renderHook(() => useMouseNavigation());

	window.dispatchEvent(new MouseEvent('mouseup', { button: 3 }));
	window.dispatchEvent(new MouseEvent('mouseup', { button: 4 }));

	expect(navigate).not.toHaveBeenCalled();
});
