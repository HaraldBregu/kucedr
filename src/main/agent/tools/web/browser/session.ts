import { AsyncLocalStorage } from 'node:async_hooks';
import type { BrowserContext, Page } from 'playwright-core';

export interface BrowserSession {
	context: BrowserContext | null;
	starting?: Promise<BrowserContext>;
	closed: boolean;
	readonly pages: Map<string, Page>;
	readonly consoleLogs: Map<string, string[]>;
	nextTabId: number;
}

export const browserSessions = new AsyncLocalStorage<BrowserSession>();

export function browserSession(): BrowserSession {
	const session = browserSessions.getStore();
	if (!session) throw new Error('Browser run has ended.');
	return session;
}
