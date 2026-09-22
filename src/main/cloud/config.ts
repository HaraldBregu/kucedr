export interface CloudConfig {
	url: string;
	publishableKey: string;
	redirectUrl: string;
}

export function loadCloudConfig(): CloudConfig | null {
	const url =
		import.meta.env.MAIN_VITE_SUPABASE_URL?.trim() ?? process.env.SUPABASE_URL?.trim();
	const publishableKey =
		import.meta.env.MAIN_VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ??
		process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
	if (!url || !publishableKey) return null;
	try {
		let validKey =
			publishableKey.startsWith('sb_publishable_') &&
			publishableKey.length > 'sb_publishable_'.length;
		if (!validKey) {
			const parts = publishableKey.split('.');
			if (parts.length === 3 && parts[1]) {
				const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as unknown;
				validKey =
					typeof payload === 'object' &&
					payload !== null &&
					'role' in payload &&
					payload.role === 'anon';
			}
		}
		if (!validKey) return null;
		const parsed = new URL(url);
		const loopback = parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
		if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback)) return null;
		if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
			return null;
		}
		return {
			url: parsed.origin,
			publishableKey,
			redirectUrl: 'kucedr://auth/callback',
		};
	} catch {
		return null;
	}
}
