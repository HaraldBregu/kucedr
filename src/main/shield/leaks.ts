import { storedSecrets } from './secrets';

// True when the text carries a stored key or token, as is or URL-encoded.
export function leaks(text: string): boolean {
	return storedSecrets().some((secret) => text.includes(secret) || text.includes(encodeURIComponent(secret)));
}
