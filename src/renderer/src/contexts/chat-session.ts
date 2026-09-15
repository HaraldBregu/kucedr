import { createContext, useContext } from 'react';

export const DEFAULT_CHAT_SESSION_ID = 'home';

const CHAT_SESSION_STORAGE_KEY = 'chat-session-id';

export function readPersistedChatSessionId(): string {
	try {
		return localStorage.getItem(CHAT_SESSION_STORAGE_KEY) ?? DEFAULT_CHAT_SESSION_ID;
	} catch {
		return DEFAULT_CHAT_SESSION_ID;
	}
}

export function persistChatSessionId(sessionId: string): void {
	try {
		localStorage.setItem(CHAT_SESSION_STORAGE_KEY, sessionId);
	} catch {
		/* empty */
	}
}

interface ChatSessionContextValue {
	sessionId: string;
	setSessionId: (sessionId: string) => void;
	sessionTitle?: string;
	setSessionTitle?: (title: string | undefined) => void;
}

export const ChatSessionContext = createContext<ChatSessionContextValue>({
	sessionId: DEFAULT_CHAT_SESSION_ID,
	setSessionId: () => {},
	sessionTitle: undefined,
	setSessionTitle: () => {},
});

export function useChatSession(): ChatSessionContextValue {
	return useContext(ChatSessionContext);
}
