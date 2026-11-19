import { EventEmitter } from 'node:events';
import type { Page } from 'playwright-core';

export const pane = { width: 1280, height: 800, scale: 1, order: 0 };
export const paneEvents = new EventEmitter();
export const pageChats = new WeakMap<Page, string>();
export const pageOrder = new WeakMap<Page, number>();
export const pageLoading = new WeakSet<Page>();
export const acting = new Map<string, number>();
