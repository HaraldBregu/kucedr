import { createContext, useContext } from 'react';
import { DEFAULT_WORKSPACE, type WorkspaceInfo } from '@shared/workspaces_types';

interface SpacesContextValue {
	current: string;
	workspaces: WorkspaceInfo[];
	select: (id: string) => Promise<void>;
}

export const SpacesContext = createContext<SpacesContextValue>({
	current: DEFAULT_WORKSPACE,
	workspaces: [],
	select: async () => {},
});

export function useSpaces(): SpacesContextValue {
	return useContext(SpacesContext);
}
