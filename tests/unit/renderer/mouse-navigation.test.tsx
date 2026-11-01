import { renderHook, act } from '@testing-library/react';
import { useMouseNavigation } from '../../../src/renderer/src/hooks/mouse';

const navigate = jest.fn();
jest.mock('../../../src/renderer/src/router', () => ({ router: { navigate: (...args: unknown[]) => navigate(...args) } }));

describe('trackpad navigation', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' });
		navigate.mockClear();
	});

	afterEach(() => jest.useRealTimers());

	it('navigates once per horizontal gesture in either direction', () => {
		renderHook(() => useMouseNavigation());
		act(() => {
			window.dispatchEvent(new WheelEvent('wheel', { deltaX: -60 }));
			window.dispatchEvent(new WheelEvent('wheel', { deltaX: -60 }));
			window.dispatchEvent(new WheelEvent('wheel', { deltaX: -120 }));
		});
		expect(navigate).toHaveBeenCalledTimes(1);
		expect(navigate).toHaveBeenLastCalledWith(-1);
		act(() => {
			jest.advanceTimersByTime(250);
			window.dispatchEvent(new WheelEvent('wheel', { deltaX: 120 }));
		});
		expect(navigate).toHaveBeenLastCalledWith(1);
	});

	it('does not navigate for vertical scrolling or horizontal scrollable content', () => {
		renderHook(() => useMouseNavigation());
		const scroller = document.createElement('div');
		scroller.style.overflowX = 'auto';
		Object.defineProperty(scroller, 'scrollWidth', { value: 200 });
		Object.defineProperty(scroller, 'clientWidth', { value: 100 });
		document.body.appendChild(scroller);
		act(() => {
			window.dispatchEvent(new WheelEvent('wheel', { deltaX: 10, deltaY: 120 }));
			scroller.dispatchEvent(new WheelEvent('wheel', { deltaX: 120, bubbles: true }));
		});
		expect(navigate).not.toHaveBeenCalled();
		scroller.remove();
	});

	it('allows navigation from a scrollable panel at its horizontal boundary', () => {
		renderHook(() => useMouseNavigation());
		const scroller = document.createElement('div');
		scroller.style.overflowY = 'auto';
		scroller.style.overflowX = 'auto';
		Object.defineProperty(scroller, 'scrollWidth', { value: 101 });
		Object.defineProperty(scroller, 'clientWidth', { value: 100 });
		document.body.appendChild(scroller);
		act(() => {
			scroller.dispatchEvent(new WheelEvent('wheel', { deltaX: -35, deltaY: 25, bubbles: true }));
			scroller.dispatchEvent(new WheelEvent('wheel', { deltaX: -35, deltaY: 25, bubbles: true }));
		});
		expect(navigate).toHaveBeenCalledWith(-1);
		scroller.remove();
	});

	it('allows forward navigation over a vertical panel with incidental horizontal overflow', () => {
		renderHook(() => useMouseNavigation());
		const scroller = document.createElement('div');
		scroller.className = 'overflow-y-auto';
		scroller.style.overflowX = 'auto';
		Object.defineProperty(scroller, 'scrollWidth', { value: 200 });
		Object.defineProperty(scroller, 'clientWidth', { value: 100 });
		document.body.appendChild(scroller);
		act(() => {
			scroller.dispatchEvent(new WheelEvent('wheel', { deltaX: 70, bubbles: true }));
		});
		expect(navigate).toHaveBeenCalledWith(1);
		scroller.remove();
	});
});
