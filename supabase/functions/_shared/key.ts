export async function key(): Promise<CryptoKey> {
	const encoded = Deno.env.get('STORAGE_PROVIDER_ENCRYPTION_KEY');
	if (!encoded) throw new Error('Provider encryption is not configured');
	let bytes: Uint8Array;
	try {
		bytes = Uint8Array.from(atob(encoded), (part) => part.charCodeAt(0));
	} catch {
		throw new Error('Provider encryption key is invalid');
	}
	if (bytes.byteLength !== 32) throw new Error('Provider encryption key is invalid');
	return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
