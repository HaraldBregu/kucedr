import { act, renderHook, waitFor } from '@testing-library/react';
import { useAppTheme } from '../../../src/renderer/src/components/app/navigationbar/hooks/useAppTheme';
import type { AppThemeData } from '../../../src/shared/app_types';

it('applies selected palettes immediately and clears previous theme tokens', async () => {
	let update: (theme: AppThemeData) => void = () => undefined;
	let resolveInitial: (theme: AppThemeData) => void = () => undefined;
	const initial = new Promise<AppThemeData>((resolve) => { resolveInitial = resolve; });
	const unsubscribe = jest.fn();
	Object.defineProperty(window, 'app', { configurable: true, value: {
		getThemeData: () => initial,
		onThemeModeChanged: (callback: typeof update) => { update = callback; return unsubscribe; },
	} });
	const { unmount } = renderHook(() => useAppTheme());
	act(() => update({ themeMode: 'dark', isDark: true, colors: { background: 'red', 'font-sans': 'serif' } }));
	act(() => resolveInitial({ themeMode: 'light', isDark: false, colors: { background: 'white' } }));
	await waitFor(() => expect(document.documentElement.style.getPropertyValue('--background')).toBe('red'));
	expect(document.documentElement).toHaveClass('dark');
	act(() => update({ themeMode: 'light', isDark: false, colors: { background: 'blue' } }));
	expect(document.documentElement.style.getPropertyValue('--background')).toBe('blue');
	expect(document.documentElement.style.getPropertyValue('--font-sans')).toBe('');
	unmount();
	expect(unsubscribe).toHaveBeenCalled();
	document.documentElement.removeAttribute('style');
	document.documentElement.classList.remove('dark');
});
