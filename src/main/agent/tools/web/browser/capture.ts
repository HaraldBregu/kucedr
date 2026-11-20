import { createDecipheriv } from 'node:crypto';
import { offerFor, saveLogin, setNever } from '../../../../browser/passwords';
import { acting, paneEvents, type BrowserTab } from './pane';

export const CAPTURE_PREFIX = 'kucedr-capture:';

export function drop(tab: BrowserTab): void {
	tab.offer?.password.fill(0);
	tab.offer = undefined;
}

// A console line from the autofill world: `prefix iv.ciphertext`, AES-GCM under the tab's capture
// key, holding the page origin, username and password typed at sign-in. A page cannot write one,
// since it never sees the key. Returns true when the line was a capture, so it is never logged.
export function readCapture(tab: BrowserTab, message: string): boolean {
	if (!message.startsWith(CAPTURE_PREFIX)) return false;
	// The agent's input counts as real input too, so nothing is captured while it drives the tab.
	if (!tab.captureKey || (tab.chat && acting.has(tab.chat))) return true;
	let fields: { o: string; u: string; p: string };
	try {
		const [iv, sealed] = message.slice(CAPTURE_PREFIX.length).split('.').map((part) => Buffer.from(part, 'base64'));
		const decipher = createDecipheriv('aes-256-gcm', tab.captureKey, iv).setAuthTag(sealed.subarray(-16));
		fields = JSON.parse(Buffer.concat([decipher.update(sealed.subarray(0, -16)), decipher.final()]).toString('utf8'));
	} catch {
		return true;
	}
	const password = Buffer.from(fields.p, 'utf8');
	if (tab.offer && tab.offer.url === fields.o && tab.offer.username === fields.u && tab.offer.password.equals(password)) {
		password.fill(0);
		return true;
	}
	const offer = offerFor(fields.o, fields.u, password);
	drop(tab);
	if (offer) tab.offer = { url: fields.o, username: fields.u, password, update: offer === 'update' };
	else password.fill(0);
	paneEvents.emit('change');
	return true;
}

export function answerOffer(tab: BrowserTab, answer: 'save' | 'never' | 'dismiss'): void {
	const offer = tab.offer;
	if (!offer) return;
	try {
		if (answer === 'save') saveLogin(offer.url, offer.username, offer.password);
		if (answer === 'never') setNever(offer.url, true);
	} finally {
		drop(tab);
		paneEvents.emit('change');
	}
}
