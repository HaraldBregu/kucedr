import { Fragment, useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_WORKSPACE, type WorkspacesState } from '@shared/workspaces_types';
import { active } from './active';
import { SpacesContext } from './context';
import { scoped } from './scoped';

export function SpacesGate({ children }: { readonly children: ReactNode }): ReactElement | null {
	const navigate = useNavigate();
	const [state, setState] = useState<WorkspacesState>();
	const refresh = useCallback(
		() =>
			(window.workspaces?.list() ?? Promise.reject())
				.then((next) => {
					active.id = next.current;
					setState(next);
				})
				.catch(() => setState((value) => value ?? { current: DEFAULT_WORKSPACE, workspaces: [] })),
		[]
	);
	const select = useCallback((id: string) => window.workspaces.select(id), []);
	useEffect(() => {
		void refresh();
		return window.workspaces?.onChanged(() => void refresh());
	}, [refresh]);
	useEffect(
		() =>
			window.agent.onOpenSession(({ sessionId, workspaceId }) => {
				if (workspaceId === active.id) return;
				localStorage.setItem(scoped('chat-session-id', workspaceId), sessionId);
				navigate('/home');
				void select(workspaceId);
			}),
		[navigate, select]
	);
	if (!state) return null;
	active.id = state.current;
	return (
		<SpacesContext.Provider value={{ ...state, select }}>
			<Fragment key={state.current}>{children}</Fragment>
		</SpacesContext.Provider>
	);
}
