import { useEffect } from 'react';

export function useZoom(): void {
	useEffect(() => {
		void window.app.getZoomFactor().then(window.win.zoom);
		return window.app.onZoomFactorChanged(window.win.zoom);
	}, []);
}
