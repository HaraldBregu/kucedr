import type { Service } from './services.ts';

export async function probe(service: Service, key: string, send: typeof fetch = fetch): Promise<boolean> {
	const response = await send(`${service.origin}${service.test}`, {
		headers: { ...service.defaults, ...service.auth(key) },
		redirect: 'manual',
		signal: AbortSignal.timeout(10_000),
	});
	await response.body?.cancel();
	if (response.ok) return true;
	if (response.status === 401 || response.status === 403) return false;
	throw new Error('Provider unavailable');
}
