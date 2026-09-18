import { createContext, useContext } from 'react';

interface NavigationBarContextValue {
	isMac: boolean;
	isFullScreen: boolean;
}

const NavigationBarContext = createContext<NavigationBarContextValue>({
	isMac: false,
	isFullScreen: false,
});

export const useNavigationBarContext = () => useContext(NavigationBarContext);
export const NavigationBarProvider = NavigationBarContext.Provider;
