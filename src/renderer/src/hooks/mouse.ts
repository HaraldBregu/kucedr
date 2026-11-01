import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useMouseNavigation(): void {
	const navigate = useNavigate();
	useEffect(() => {
		if (!navigator.platform.startsWith('Mac')) return;
		const handleMouseUp = (event: MouseEvent): void => {
			if (event.button === 3) void navigate(-1);
			if (event.button === 4) void navigate(1);
		};

		window.addEventListener('mouseup', handleMouseUp);
		return () => window.removeEventListener('mouseup', handleMouseUp);
	}, [navigate]);
}
