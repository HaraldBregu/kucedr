import { app, BrowserWindow, Notification } from 'electron';
import type { RunSignal } from '../agent/types';
import { notificationLine } from './line';

export function createNotifier(deps: {
	enabled: () => boolean;
	title: (signal: RunSignal) => string;
	line: (key: string) => string;
	open: (windowId: number, sessionId: string) => void;
}): {
	run: (signal: RunSignal) => void;
	view: (windowId: number, sessionId: string | null) => void;
} {
	const views = new Map<number, string | null>();
	const shown = new Map<string, Notification>();
	const clear = (sessionId: string): void => {
		shown.get(sessionId)?.close();
		if (shown.delete(sessionId)) app.setBadgeCount(shown.size);
	};
	app.on('browser-window-focus', (_event, window) => {
		const sessionId = views.get(window.id);
		if (sessionId) clear(sessionId);
	});
	return {
		view(windowId, sessionId) {
			views.set(windowId, sessionId);
			if (sessionId && BrowserWindow.fromId(windowId)?.isFocused()) clear(sessionId);
		},
		run(signal) {
			const line = notificationLine(signal);
			if (!line || !deps.enabled()) return;
			if (
				[...views].some(
					([windowId, sessionId]) =>
						sessionId === signal.sessionId && BrowserWindow.fromId(windowId)?.isFocused()
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
