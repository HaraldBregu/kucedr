import { BrowserWindow, webContents } from 'electron';

export interface AppEvent {
	type: string;
	payload: unknown;
	timestamp: number;
}

export interface AppEvents {
	'service:initialized': { service: string };
	'service:destroyed': { service: string };
	'error:critical': { error: Error; context: string };
	'window:created': { windowId: number; type: string };
	'window:closed': { windowId: number };
	'tray:set-enabled': { enabled: boolean };
	'language:changed': { language: import('../shared/app_types').AppLanguage };
	'channel:status': import('../shared').ChannelStatusEvent;
	'channel:route': {
		channel: import('../shared').ChannelType;
		accountId?: string;
		to: string;
		threadId?: string;
		replyToMessageId?: string;
		chatType?: import('./channels/channels_types').ChannelChatType;
		sessionKey?: string;
	};
}

/**
 * Centralized event bus for both Main -> Renderer and Main Process events.
 *
 * - broadcast() and sendTo(): For Main -> Renderer IPC communication
 * - emit() and on(): For typed Main Process events (analytics, logging, monitoring)
 */
export class EventBus {
	private mainProcessListeners = new Map<string, Set<(event: AppEvent) => void>>();
	/**
	 * Broadcast a message to all open renderer windows.
	 */
	broadcast(channel: string, ...args: unknown[]): void {
		webContents.getAllWebContents().forEach((contents) => {
			if (!contents.isDestroyed()) contents.send(channel, ...args);
		});
	}

	broadcastToWindows(channel: string, ...args: unknown[]): void {
		BrowserWindow.getAllWindows().forEach((win) => {
			if (!win.isDestroyed()) win.webContents.send(channel, ...args);
		});
	}

	/**
	 * Send a message to a specific window.
	 */
	sendTo(windowId: number, channel: string, ...args: unknown[]): void {
		const win = BrowserWindow.fromId(windowId);
		if (win && !win.isDestroyed()) {
			win.webContents.send(channel, ...args);
		}
	}

	/**
	 * Emit a typed event within the main process.
	 * Used for cross-cutting concerns like analytics, logging, and monitoring.
	 *
	 * @param type - The event type (must be a key in AppEvents)
	 * @param payload - The event payload (typed based on event type)
	 */
	emit<K extends keyof AppEvents>(type: K, payload: AppEvents[K]): void {
		const event: AppEvent = {
			type,
			payload,
			timestamp: Date.now(),
		};

		this.mainProcessListeners.get(type)?.forEach((callback) => {
			try {
				callback(event);
			} catch (err) {
				console.error(`[EventBus] Listener error for ${type}:`, err);
			}
		});
	}

	/**
	 * Subscribe to a typed event within the main process.
	 * Returns an unsubscribe function to remove the listener.
	 *
	 * @param type - The event type to listen for
	 * @param callback - Function to call when the event is emitted
	 * @returns Unsubscribe function
	 */
	on<K extends keyof AppEvents>(type: K, callback: (event: AppEvent) => void): () => void {
		if (!this.mainProcessListeners.has(type)) {
			this.mainProcessListeners.set(type, new Set());
		}
		this.mainProcessListeners.get(type)!.add(callback);

		return () => {
			this.mainProcessListeners.get(type)?.delete(callback);
		};
	}

	/**
	 * Remove all listeners for a specific event type.
	 * Useful for cleanup during service shutdown.
	 */
	off<K extends keyof AppEvents>(type: K): void {
		this.mainProcessListeners.delete(type);
	}

	/**
	 * Clear all main process event listeners.
	 * Should be called during application shutdown.
	 */
	clearAllListeners(): void {
		this.mainProcessListeners.clear();
	}
}
