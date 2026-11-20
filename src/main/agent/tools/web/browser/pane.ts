import { EventEmitter } from 'node:events';
import type { BrowserWindow, WebContentsView } from 'electron';

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
	host?: BrowserWindow;
}

export const pane = { width: 1280, height: 800, order: 0, next: 1 };
export const paneTabs = new Map<string, BrowserTab>();
export const paneEvents = new EventEmitter();
export const acting = new Map<string, number>();
