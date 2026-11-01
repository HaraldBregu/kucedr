import { useEffect } from 'react';
import { router } from '../router';

export function useMouseNavigation(): void {
	useEffect(() => {
		if (!navigator.platform.startsWith('Mac')) return;
		let distance = 0;
		let navigated = false;
		let timer: ReturnType<typeof setTimeout> | undefined;

		const handleMouseUp = (event: MouseEvent): void => {
			if (event.button === 3) void router.navigate(-1);
			if (event.button === 4) void router.navigate(1);
		};

		const handleWheel = (event: WheelEvent): void => {
			if (event.ctrlKey || event.shiftKey || event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return;
			if (Math.abs(event.deltaX) < Math.abs(event.deltaY) * 0.5) return;

			for (const node of event.composedPath()) {
				if (!(node instanceof HTMLElement)) continue;
				const overflow = getComputedStyle(node).overflowX;
				if (overflow !== 'auto' && overflow !== 'scroll') continue;
				const maxScroll = node.scrollWidth - node.clientWidth;
				if ((event.deltaX < 0 && node.scrollLeft > 0) || (event.deltaX > 0 && node.scrollLeft < maxScroll - 1)) {
					return;
				}
			}

			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				distance = 0;
				navigated = false;
			}, 250);
			if (navigated) return;
			distance += event.deltaX;
			if (Math.abs(distance) >= 60) {
				navigated = true;
				void router.navigate(distance < 0 ? -1 : 1);
			}
		};

		window.addEventListener('mouseup', handleMouseUp);
		window.addEventListener('wheel', handleWheel, { passive: true, capture: true });
		return () => {
			window.removeEventListener('mouseup', handleMouseUp);
			window.removeEventListener('wheel', handleWheel, true);
			if (timer) clearTimeout(timer);
		};
	}, []);
}
