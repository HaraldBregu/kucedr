import { AsyncLocalStorage } from 'node:async_hooks';
import type { BrowserContext, Page } from 'playwright-core';

export interface BrowserSession {
	context: BrowserContext | null;
	starting?: Promise<BrowserContext>;
	readonly background: boolean;
	closed: boolean;
	readonly pages: Map<string, Page>;
	readonly consoleLogs: Map<string, string[]>;
	nextTabId: number;
}

export const browserSessions = new AsyncLocalStorage<BrowserSession>();
export const interactive: BrowserSession = {
	context: null,
	background: false,
	closed: false,
	pages: new Map(),
	consoleLogs: new Map(),
	nextTabId: 1,
};

export function browserSession(): BrowserSession {
	return browserSessions.getStore() ?? interactive;
}
