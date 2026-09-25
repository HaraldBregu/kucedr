import { useEffect } from 'react';
import type { WindowRadius } from '@shared/window_radius';

export function useWindowRadius(): void {
	useEffect(() => {
		let active = true;
		let changed = false;
		const apply = (radius: WindowRadius): void => {
			changed = true;
			if (active) document.documentElement.style.setProperty('--app-window-radius', `${radius}px`);
		};
		const unsubscribe = window.app.onWindowRadiusChanged(apply);
		void window.app.getWindowRadius().then((radius) => {
			if (!changed) apply(radius);
		});
		return () => {
			active = false;
			unsubscribe();
		};
	}, []);
}
