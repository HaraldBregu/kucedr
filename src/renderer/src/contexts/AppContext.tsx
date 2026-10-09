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
import { configureSounds } from '@/lib/sounds/configure';
import { playSound } from '@/lib/sounds/play';
import type {
	AppLanguage,
	AppTheme,
	VoiceAgentAppearance,
} from '../../../shared/app_types';

const LANGUAGE_STORAGE_KEY = 'app-language';
const THEME_STORAGE_KEY = 'app-theme';
const VOICE_AGENT_APPEARANCE_STORAGE_KEY = 'voice-agent-appearance';

export type { AppLanguage, AppTheme, VoiceAgentAppearance };
export type SidebarState = 'expanded' | 'collapsed';

export interface AppContextValue {
	language: AppLanguage;
	setLanguage: (language: AppLanguage) => void;
	theme: AppTheme;
	setTheme: (theme: AppTheme) => void;
	soundFeedbackEnabled: boolean;
	setSoundFeedbackEnabled: (enabled: boolean) => void;
	voiceAgentAppearance: VoiceAgentAppearance;
	setVoiceAgentAppearance: (appearance: VoiceAgentAppearance) => void;
	resetState: () => void;
}

interface AppProviderProps {
	children: ReactNode;
	initialState?: {
		language?: AppLanguage;
		theme?: AppTheme;
		voiceAgentAppearance?: VoiceAgentAppearance;
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

function readPersistedVoiceAgentAppearance(): VoiceAgentAppearance {
	try {
		if (localStorage.getItem(VOICE_AGENT_APPEARANCE_STORAGE_KEY) === 'orb-07') return 'orb-07';
	} catch {
		/* empty */
	}
	return 'persona';
}

function applyTheme(theme: AppTheme): void {
	const dark =
		theme === 'dark' ||
		(theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
	document.documentElement.classList.toggle('dark', dark);
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children, initialState }: AppProviderProps): React.JSX.Element {
	const [soundFeedbackEnabled, setSoundFeedbackEnabledState] = useState(false);
	const [language, setLanguageState] = useState<AppLanguage>(
		initialState?.language ?? readPersistedLanguage()
	);
	const [theme, setThemeState] = useState<AppTheme>(
		initialState?.theme ?? readPersistedTheme()
	);
	const [voiceAgentAppearance, setVoiceAgentAppearanceState] = useState<VoiceAgentAppearance>(
		initialState?.voiceAgentAppearance ?? readPersistedVoiceAgentAppearance()
	);

	// localStorage is the synchronous paint cache (avoids a theme/language flash);
	// the app settings store is the durable source of truth, hydrated on mount.
	const hydrated = useRef(false);

	const setLanguage = useCallback((next: AppLanguage) => setLanguageState(next), []);
	const setTheme = useCallback((next: AppTheme) => {
		if (next === theme) return;
		playSound('theme');
		setThemeState(next);
	}, [theme]);
	const setSoundFeedbackEnabled = useCallback((enabled: boolean) => {
		configureSounds(enabled);
		setSoundFeedbackEnabledState(enabled);
		void window.app.setSoundFeedbackEnabled(enabled);
		if (enabled) playSound('navigate');
	}, []);
	const setVoiceAgentAppearance = useCallback(
		(next: VoiceAgentAppearance) => setVoiceAgentAppearanceState(next),
		[]
	);
	const resetState = useCallback(() => {
		setLanguageState(readPersistedLanguage());
		setThemeState(readPersistedTheme());
		setVoiceAgentAppearanceState(readPersistedVoiceAgentAppearance());
	}, []);

	useEffect(() => {
		let active = true;
		const apply = (enabled: boolean): void => {
			if (!active) return;
			configureSounds(enabled);
			setSoundFeedbackEnabledState(enabled);
		};
		const unsubscribe = window.app.onSoundFeedbackEnabledChanged(apply);
		void window.app.getSoundFeedbackEnabled().then(apply);
		return () => {
			active = false;
			unsubscribe();
			configureSounds(false);
		};
	}, []);

	useEffect(() => {
		const offAppearanceChanged = window.app.onVoiceAgentAppearanceChanged(
			setVoiceAgentAppearanceState
		);
		void Promise.all([
			window.app.getLanguage(),
			window.app.getTheme(),
			window.app.getVoiceAgentAppearance(),
		]).then(([lang, th, appearance]) => {
			setLanguageState(lang);
			setThemeState(th);
			setVoiceAgentAppearanceState(appearance);
			hydrated.current = true;
		});
		return offAppearanceChanged;
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

	useEffect(() => {
		try {
			localStorage.setItem(VOICE_AGENT_APPEARANCE_STORAGE_KEY, voiceAgentAppearance);
		} catch {
			/* empty */
		}
		if (hydrated.current) void window.app.setVoiceAgentAppearance(voiceAgentAppearance);
	}, [voiceAgentAppearance]);

	const value = useMemo<AppContextValue>(
		() => ({
			language,
			setLanguage,
			theme,
			setTheme,
			soundFeedbackEnabled,
			setSoundFeedbackEnabled,
			voiceAgentAppearance,
			setVoiceAgentAppearance,
			resetState,
		}),
		[
			language,
			setLanguage,
			theme,
			setTheme,
			soundFeedbackEnabled,
			setSoundFeedbackEnabled,
			voiceAgentAppearance,
			setVoiceAgentAppearance,
			resetState,
		]
	);

	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
	const ctx = useContext(AppContext);
	if (ctx === undefined) throw new Error('useApp must be used within an AppProvider');
	return ctx;
}
