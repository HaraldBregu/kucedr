import { useEffect } from 'react';
import type { AppThemeData } from '@shared/app_types';

export function useAppTheme(): void {
	useEffect(() => {
		let active = true;
		const apply = (theme: AppThemeData): void => {
			if (!active) return;
			document.documentElement.classList.toggle('dark', theme.isDark);
			for (const [name, value] of Object.entries(theme.colors)) {
				document.documentElement.style.setProperty(`--${name}`, value);
			}
			document.documentElement.style.visibility = 'visible';
		};
		void window.app
			.getThemeData()
			.then(apply)
			.catch(() => {
				document.documentElement.style.visibility = 'visible';
			});
		const unsubscribe = window.app.onThemeModeChanged(apply);
		return () => {
			active = false;
			unsubscribe();
		};
	}, []);
}
