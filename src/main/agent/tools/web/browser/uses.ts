import type { BrowserSitePermission } from '../../../../../shared/browser';

// What an Electron permission asks of the user; empty when the pane denies it without asking.
export function uses(permission: string, media: readonly string[] = []): BrowserSitePermission[] {
	if (permission !== 'media') return [];
	const kinds: BrowserSitePermission[] = [];
	if (media.includes('video')) kinds.push('camera');
	if (media.includes('audio')) kinds.push('microphone');
	return kinds;
}
