import { app, BrowserWindow, Notification } from 'electron';
import type { RunSignal } from '../agent/types';
import { notificationLine } from './line';

export function createNotifier(deps: {
	enabled: () => boolean;
	title: (signal: RunSignal) => string;
	line: (key: string) => string;
	open: (windowId: number, sessionId: string) => void;
	resolve: (sessionId: string, workspaceId: string) => string;
}): {
	run: (signal: RunSignal) => void;
	view: (windowId: number, sessionId: string | null, workspaceId: string) => void;
} {
	const views = new Map<number, { sessionId: string | null; workspaceId: string }>();
	const shown = new Map<string, Notification>();
	const clear = (sessionId: string): void => {
		shown.get(sessionId)?.close();
		if (shown.delete(sessionId)) app.setBadgeCount(shown.size);
	};
	app.on('browser-window-focus', (_event, window) => {
		const view = views.get(window.id);
		if (view?.sessionId) clear(deps.resolve(view.sessionId, view.workspaceId));
	});
	return {
		view(windowId, sessionId, workspaceId) {
			views.set(windowId, { sessionId, workspaceId });
			if (sessionId && BrowserWindow.fromId(windowId)?.isFocused())
				clear(deps.resolve(sessionId, workspaceId));
		},
		run(signal) {
			const line = notificationLine(signal);
			if (!line || !deps.enabled()) return;
			if (
				[...views].some(
					([windowId, view]) =>
						view.sessionId &&
						view.workspaceId === signal.workspaceId &&
						BrowserWindow.fromId(windowId)?.isFocused() &&
						deps.resolve(view.sessionId, view.workspaceId) === signal.sessionId
				)
			)
				return;
			shown.get(signal.sessionId)?.close();
			const notification = new Notification({
				title: deps.title(signal),
				body: deps.line(line),
			});
			// ponytail: a click does nothing when every window is closed; reopen through the window factory if that matters
			notification.on('click', () => {
				const window =
					BrowserWindow.fromId(signal.windowId ?? [...views.keys()].at(-1) ?? -1) ??
					BrowserWindow.getAllWindows()[0];
				if (!window) return;
				window.show();
				window.focus();
				deps.open(window.id, signal.sessionId);
			});
			shown.set(signal.sessionId, notification);
			app.setBadgeCount(shown.size);
			notification.show();
		},
	};
}
