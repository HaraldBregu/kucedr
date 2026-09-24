import { key } from './key.ts';

export async function seal(value: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = new Uint8Array(await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(value)
	));
	const stored = new Uint8Array(iv.length + encrypted.length);
	stored.set(iv);
	stored.set(encrypted, iv.length);
	return btoa(String.fromCharCode(...stored));
}
