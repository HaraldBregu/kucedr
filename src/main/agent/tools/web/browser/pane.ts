import { EventEmitter } from 'node:events';
import type { BrowserWindow, DownloadItem, WebContents, WebContentsView } from 'electron';
import type {
	BrowserBlocked,
	BrowserDownload,
	BrowserPermissionRequest,
	BrowserRoute,
} from '../../../../../shared/browser';

export interface BrowserTab {
	readonly id: string;
	readonly view: WebContentsView;
	readonly logs: string[];
	readonly route: BrowserRoute;
	readonly partition: string;
	// Settles when the tab's connection is in place; rejects when Tor or the proxy is unavailable.
	readonly ready: Promise<void>;
	readonly blocked: BrowserBlocked[];
	// path is the holding file until the user agrees, then the file in Downloads; received is set
	// when the bytes arrived before the answer.
	download?: BrowserDownload & { readonly item: DownloadItem; readonly path: string; readonly received?: boolean };
	chat?: string;
	owner?: string;
	agent?: boolean;
	order: number;
	position: number;
	error?: string;
	icon?: string;
	pointer?: { x: number; y: number };
	filled?: boolean;
	host?: BrowserWindow;
	// Encrypts what the page's private script world reports about a sign-in; known only to main
	// and that world.
	captureKey?: Buffer;
	// A sign-in waiting for the user's answer; the password stays in main memory only.
	offer?: { url: string; username: string; password: Buffer; update: boolean };
	pending?: { entries: { url: string; title: string }[]; index: number };
}

export const pane = { width: 1280, height: 800, order: 0, position: 0, next: 1 };
export const paneTabs = new Map<string, BrowserTab>();
export const paneEvents = new EventEmitter();
export const acting = new Map<string, number>();
// The tab each app window currently shows in its pane, keyed by that window's renderer.
export const paneShown = new Map<WebContents, BrowserTab>();
