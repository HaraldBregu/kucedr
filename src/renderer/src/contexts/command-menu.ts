import { createContext, useContext } from 'react';

const CommandMenuContext = createContext({ open: () => {} });

export const CommandMenuProvider = CommandMenuContext.Provider;

export function useCommandMenu(): { open: () => void } {
	return useContext(CommandMenuContext);
}
