import type { SupabaseClient } from '@supabase/supabase-js';

/** The account's sealed keys file in the private `credentials` bucket. Storage only ever sees ciphertext. */
export class CredentialBucket {
	constructor(private readonly client: SupabaseClient) {}

	async read(userId: string): Promise<string | null> {
		const { data, error } = await this.client.storage.from('credentials').download(`${userId}/keys.json`);
		if (!error) return data.text();
		const { status, statusCode } = error as { status?: number; statusCode?: string };
		if (status === 404 || statusCode === '404') return null;
		throw new Error('Could not reach your account storage. Check your connection.');
	}

	async write(userId: string, text: string): Promise<void> {
		const { error } = await this.client.storage
			.from('credentials')
			.upload(`${userId}/keys.json`, new Blob([text], { type: 'application/json' }), {
				upsert: true,
				contentType: 'application/json',
				cacheControl: '0',
			});
		if (error) throw new Error('Could not save your API keys to your account. Try again.');
	}
}
