import React, {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useReducer,
	useState,
	type ReactNode,
} from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageContext, type ContextValue } from './context/context';
import { pageReducer } from './context/reducer';
import {
	DEFAULT_SIDEBAR_WIDTH,
	INITIAL_PAGE_STATE,
	MAX_SIDEBAR_WIDTH,
	MIN_SIDEBAR_WIDTH,
	type PageState,
} from './context/state';

const SIDEBAR_STATE_STORAGE_KEY = 'page_sidebar_layout_state';
const SIDEBAR_KEYBOARD_SHORTCUT = '';
const SIDEBAR_WIDTH_STORAGE_KEY = 'kucedr_sidebar_width';

interface ProviderProps {
	readonly children: ReactNode;
	readonly initialState?: Partial<PageState>;
}

export const Provider = memo(function Provider({
	children,
	initialState,
}: ProviderProps): React.ReactElement {
	const [state, dispatch] = useReducer(pageReducer, {
		...INITIAL_PAGE_STATE,
		sidebarOpen: window.localStorage.getItem(SIDEBAR_STATE_STORAGE_KEY) !== 'false',
		...initialState,
	});
	const [sidebarWidth, setSidebarWidthState] = useState(() => {
		const storedWidth = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
		return Number.isFinite(storedWidth) && storedWidth > 0
			? Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, storedWidth))
			: DEFAULT_SIDEBAR_WIDTH;
	});
	const isMobile = useIsMobile();

	const setSidebarWidth = useCallback((width: number): void => {
		const nextWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
		setSidebarWidthState(nextWidth);
		window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(nextWidth));
	}, []);

	useLayoutEffect(() => {
		document.documentElement.style.setProperty('--app-sidebar-width', `${sidebarWidth}px`);
	}, [sidebarWidth]);

	const toggleSidebar = useCallback(() => {
		if (isMobile) {
			dispatch({ type: 'SIDEBAR_OPEN_MOBILE_TOGGLED' });
		} else {
			dispatch({ type: 'SIDEBAR_OPEN_TOGGLED' });
		}
	}, [isMobile]);

	useEffect(() => {
		window.localStorage.setItem(SIDEBAR_STATE_STORAGE_KEY, String(state.sidebarOpen));
	}, [state.sidebarOpen]);

	useEffect(() => {
		if (!SIDEBAR_KEYBOARD_SHORTCUT) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				toggleSidebar();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [toggleSidebar]);

	const value = useMemo<ContextValue>(
		() => ({ state, dispatch, isMobile, sidebarWidth, setSidebarWidth, toggleSidebar }),
		[state, isMobile, sidebarWidth, setSidebarWidth, toggleSidebar]
	);
	return <PageContext.Provider value={value}>{children}</PageContext.Provider>;
});
