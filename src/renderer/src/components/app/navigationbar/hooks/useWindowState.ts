import { useState, useEffect } from 'react';

export function useWindowState() {
	const [isFullScreen, setIsFullScreen] = useState(false);
	const [isMaximized, setIsMaximized] = useState(false);

	useEffect(() => {
		if (!window.win) return;

		void window.win.isFullScreen().then(setIsFullScreen);
		void window.win.isMaximized().then(setIsMaximized);

		const unsubFs = window.win.onFullScreenChange(setIsFullScreen);
		const unsubMax = window.win.onMaximizeChange(setIsMaximized);
		return () => {
			unsubFs();
			unsubMax();
		};
	}, []);

	return { isFullScreen, isMaximized };
}
