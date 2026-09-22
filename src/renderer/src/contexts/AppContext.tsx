import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import i18n from '../i18n';
import type { AppLanguage, AppTheme } from '../../../shared/app_types';

const LANGUAGE_STORAGE_KEY = 'app-language';
const THEME_STORAGE_KEY = 'app-theme';

export type { AppLanguage, AppTheme };
export type SidebarState = 'expanded' | 'collapsed';

export interface AppContextValue {
	language: AppLanguage;
	setLanguage: (language: AppLanguage) => void;
	theme: AppTheme;
	setTheme: (theme: AppTheme) => void;
	resetState: () => void;
}

interface AppProviderProps {
	children: ReactNode;
	initialState?: {
		language?: AppLanguage;
		theme?: AppTheme;
	};
}

function readPersistedLanguage(): AppLanguage {
	try {
		const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
		if (stored === 'en' || stored === 'it') return stored;
	} catch {
		/* empty */
	}
	return 'en';
}

function readPersistedTheme(): AppTheme {
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
	} catch {
		/* empty */
	}
	return 'system';
}

function applyTheme(theme: AppTheme): void {
	const dark =
		theme === 'dark' ||
		(theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
	document.documentElement.classList.toggle('dark', dark);
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children, initialState }: AppProviderProps): React.JSX.Element {
	const [language, setLanguageState] = useState<AppLanguage>(
		initialState?.language ?? readPersistedLanguage()
	);
	const [theme, setThemeState] = useState<AppTheme>(
		initialState?.theme ?? readPersistedTheme()
	);

	// localStorage is the synchronous paint cache (avoids a theme/language flash);
	// the app settings store is the durable source of truth, hydrated on mount.
	const hydrated = useRef(false);

	const setLanguage = useCallback((next: AppLanguage) => setLanguageState(next), []);
	const setTheme = useCallback((next: AppTheme) => setThemeState(next), []);
	const resetState = useCallback(() => {
		setLanguageState(readPersistedLanguage());
		setThemeState(readPersistedTheme());
	}, []);

	useEffect(() => {
		void Promise.all([window.app.getLanguage(), window.app.getTheme()]).then(([lang, th]) => {
			setLanguageState(lang);
			setThemeState(th);
			hydrated.current = true;
		});
	}, []);

	useEffect(() => {
		i18n.changeLanguage(language);
		try {
			localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
		} catch {
			/* empty */
		}
		if (hydrated.current) void window.app.setLanguage(language);
	}, [language]);

	useEffect(() => {
		applyTheme(theme);
		try {
			localStorage.setItem(THEME_STORAGE_KEY, theme);
		} catch {
			/* empty */
		}
		if (hydrated.current) void window.app.setTheme(theme);
		if (theme !== 'system') return;
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = (): void => applyTheme('system');
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	}, [theme]);

	const value = useMemo<AppContextValue>(
		() => ({ language, setLanguage, theme, setTheme, resetState }),
		[language, setLanguage, theme, setTheme, resetState]
	);

	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
	const ctx = useContext(AppContext);
	if (ctx === undefined) throw new Error('useApp must be used within an AppProvider');
	return ctx;
}
