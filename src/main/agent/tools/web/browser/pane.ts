import { EventEmitter } from 'node:events';
import type { BrowserWindow, WebContents, WebContentsView } from 'electron';

export interface BrowserTab {
	readonly id: string;
	readonly view: WebContentsView;
	readonly logs: string[];
	chat?: string;
	owner?: string;
	order: number;
	error?: string;
	icon?: string;
	pointer?: { x: number; y: number };
	filled?: boolean;
	host?: BrowserWindow;
}

export const pane = { width: 1280, height: 800, order: 0, next: 1 };
export const paneTabs = new Map<string, BrowserTab>();
export const paneEvents = new EventEmitter();
export const acting = new Map<string, number>();
// The tab each app window currently shows in its pane, keyed by that window's renderer.
export const paneShown = new Map<WebContents, BrowserTab>();
