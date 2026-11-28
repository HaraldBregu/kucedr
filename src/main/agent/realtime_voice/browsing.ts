import { EventEmitter } from 'node:events';

// Emits 'use' when the voice agent calls the browser, so the window with the browser pane shows.
export const voiceBrowsing = new EventEmitter();
