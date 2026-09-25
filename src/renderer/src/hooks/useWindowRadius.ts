import { useEffect } from 'react';
import type { WindowRadius } from '@shared/window_radius';

export function useWindowRadius(): void {
	useEffect(() => {
		let active = true;
		const apply = (radius: WindowRadius): void => {
			if (active) document.documentElement.style.setProperty('--app-window-radius', `${radius}px`);
		};
		const unsubscribe = window.app.onWindowRadiusChanged(apply);
		void window.app.getWindowRadius().then(apply);
		return () => {
			active = false;
			unsubscribe();
		};
	}, []);
}
