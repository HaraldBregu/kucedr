import { useEffect } from 'react';
import { router } from '../router';

export function useMouseNavigation(): void {
	useEffect(() => {
		if (!navigator.platform.startsWith('Mac')) return;

		const handleMouseUp = (event: MouseEvent): void => {
			if (event.button === 3) void router.navigate(-1);
			if (event.button === 4) void router.navigate(1);
		};

		window.addEventListener('mouseup', handleMouseUp);
		return () => window.removeEventListener('mouseup', handleMouseUp);
	}, []);
}
