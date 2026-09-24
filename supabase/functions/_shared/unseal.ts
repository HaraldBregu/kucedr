import { key } from './key.ts';

export async function unseal(value: string): Promise<string> {
	const stored = Uint8Array.from(atob(value), (part) => part.charCodeAt(0));
	if (stored.length < 29) throw new Error('Provider credentials are invalid');
	const plaintext = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: stored.slice(0, 12) }, await key(), stored.slice(12)
	);
	return new TextDecoder().decode(plaintext);
}
