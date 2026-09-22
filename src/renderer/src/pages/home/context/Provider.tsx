import { useReducer, type ReactElement, type ReactNode } from 'react';
import { agentChatReducer } from './reducer';
import { initialAgentChatState } from './state';
import { HomeAgentContext } from './context';

export function Provider({
	children,
}: {
	readonly children: ReactNode;
}): ReactElement {
	const [chatState, dispatchChat] = useReducer(
		agentChatReducer,
		initialAgentChatState
	);

	return (
		<HomeAgentContext.Provider value={{ chatState, dispatchChat }}>
			{children}
		</HomeAgentContext.Provider>
	);
}
