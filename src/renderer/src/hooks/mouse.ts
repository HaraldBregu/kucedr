import { useEffect } from 'react';
import { router } from '../router';

export function useMouseNavigation(): void {
	useEffect(() => {
		if (!navigator.platform.startsWith('Mac')) return;

		const handleMouseDown = (event: MouseEvent): void => {
			if (event.button === 3) void router.navigate(-1);
			if (event.button === 4) void router.navigate(1);
		};

		window.addEventListener('mousedown', handleMouseDown, true);
		return () => window.removeEventListener('mousedown', handleMouseDown, true);
	}, []);
}
