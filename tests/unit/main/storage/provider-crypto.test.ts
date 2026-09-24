import { randomBytes } from 'node:crypto';
import { seal } from '../../../../supabase/functions/_shared/seal';
import { unseal } from '../../../../supabase/functions/_shared/unseal';

const originalDeno = (globalThis as Record<string, unknown>).Deno;
let encodedKey: string | undefined;

beforeEach(() => {
	encodedKey = randomBytes(32).toString('base64');
	(globalThis as Record<string, unknown>).Deno = {
		env: { get: (name: string) => name === 'STORAGE_PROVIDER_ENCRYPTION_KEY'
			? encodedKey : undefined },
	};
});

afterAll(() => {
	if (originalDeno === undefined) delete (globalThis as Record<string, unknown>).Deno;
	else (globalThis as Record<string, unknown>).Deno = originalDeno;
});

it('encrypts provider credentials with a fresh nonce and decrypts only with the same key', async () => {
	const first = await seal('secret-value');
	const second = await seal('secret-value');
	expect(first).not.toBe(second);
	expect(first).not.toContain('secret-value');
	expect(await unseal(first)).toBe('secret-value');
	encodedKey = randomBytes(32).toString('base64');
	await expect(unseal(first)).rejects.toThrow();
});

it('rejects missing or malformed server encryption keys', async () => {
	encodedKey = undefined;
	await expect(seal('secret-value')).rejects.toThrow('not configured');
	encodedKey = 'not-a-32-byte-key';
	await expect(seal('secret-value')).rejects.toThrow('invalid');
});
