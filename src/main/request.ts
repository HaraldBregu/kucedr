import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Readable } from 'node:stream';
import { publicUrl } from './public';

export async function publicRequest(
	value: string,
	options: { headers?: Record<string, string>; signal?: AbortSignal } = {}
): Promise<{ response: Response; url: URL }> {
	const target = await publicUrl(value);
	const request = target.url.protocol === 'https:' ? httpsRequest : httpRequest;
	return new Promise((resolve, reject) => {
		const outgoing = request(
			{
				hostname: target.address,
				family: target.family,
				port: target.url.port || undefined,
				path: `${target.url.pathname}${target.url.search}`,
				method: 'GET',
				headers: { ...options.headers, Host: target.url.host },
				signal: options.signal,
				...(target.url.protocol === 'https:' ? { servername: target.url.hostname } : {}),
			},
			(incoming) => {
				try {
					const headers = new Headers();
					for (const [name, value] of Object.entries(incoming.headers)) {
						if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
						else if (value !== undefined) headers.set(name, value);
					}
					resolve({
						response: new Response(
							[204, 205, 304].includes(incoming.statusCode ?? 500)
								? null
								: (Readable.toWeb(incoming) as unknown as BodyInit),
							{
								status: incoming.statusCode ?? 500,
								statusText: incoming.statusMessage,
								headers,
							}
						),
						url: target.url,
					});
				} catch (error) {
					incoming.destroy();
					reject(error);
				}
			}
		);
		outgoing.once('error', reject);
		outgoing.end();
	});
}
