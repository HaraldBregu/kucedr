import crypto from 'node:crypto';

type KlingTask = { id?: string; task_id?: string; status?: string; task_status?: string; message?: string; task_status_msg?: string; outputs?: Array<{ type?: string; url?: string }>; task_result?: { images?: Array<{ url?: string }>; audios?: Array<{ url_mp3?: string }>; videos?: Array<{ url?: string }> } };
type KlingResponse = { code?: number; message?: string; data?: KlingTask | KlingTask[] };

export async function generateKlingMedia(
	provider: { name: string; apiKey: string; baseURL?: string },
	path: string,
	body: Record<string, unknown>,
	mediaType: 'image' | 'video' | 'audio',
	errors: { auth: new (message: string) => Error; request: new (message: string) => Error },
	signal?: AbortSignal,
): Promise<{ base64: string; mimeType: string }> {
	if (!provider.apiKey) throw new errors.auth(`${provider.name} API key not configured.`);
	const baseURL = provider.baseURL ?? 'https://api-singapore.klingai.com';
	const [accessKey, secretKey] = provider.apiKey.split(':');
	let token = provider.apiKey;
	if (secretKey) {
		const now = Math.floor(Date.now() / 1000);
		const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
		const payload = Buffer.from(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 })).toString('base64url');
		const signature = crypto.createHmac('sha256', secretKey).update(`${header}.${payload}`).digest('base64url');
		token = `${header}.${payload}.${signature}`;
	}
	const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
	let response = await fetch(`${baseURL}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal });
	let id: string | undefined;
	for (let attempt = 0; attempt < 180; attempt++) {
		if (response.status === 401 || response.status === 403) throw new errors.auth(`${provider.name}: authentication failed.`);
		if (!response.ok) throw new errors.request(`${provider.name} request failed (${response.status}): ${await response.text()}`);
		const data = await response.json() as KlingResponse;
		if (data.code) throw new errors.request(`${provider.name}: ${data.message ?? 'generation failed'}`);
		const task = Array.isArray(data.data) ? data.data.find((item) => item.id === id) : data.data;
		id ??= task?.id ?? task?.task_id;
		if (!id) throw new errors.request(`${provider.name}: generation was not accepted.`);
		const status = task?.status ?? task?.task_status;
		if (status === 'failed') throw new errors.request(`${provider.name}: ${task?.message ?? task?.task_status_msg ?? 'generation failed'}`);
		if (status === 'succeeded' || status === 'succeed') {
			const url = task?.outputs?.find((output) => output.type === mediaType)?.url ?? (mediaType === 'image' ? task?.task_result?.images?.[0]?.url : mediaType === 'audio' ? task?.task_result?.audios?.[0]?.url_mp3 : task?.task_result?.videos?.[0]?.url);
			if (!url) throw new errors.request(`${provider.name}: result contained no ${mediaType}.`);
			const media = await fetch(url, { signal });
			if (!media.ok) throw new errors.request(`${provider.name}: could not download ${mediaType} (${media.status}).`);
			return { base64: Buffer.from(await media.arrayBuffer()).toString('base64'), mimeType: media.headers.get('content-type') ?? ({ image: 'image/png', video: 'video/mp4', audio: 'audio/mpeg' })[mediaType] };
		}
		signal?.throwIfAborted();
		if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 5000));
		response = await fetch(`${baseURL}${path.startsWith('/v1/') ? `${path}/${encodeURIComponent(id)}` : `/tasks?task_ids=${encodeURIComponent(id)}`}`, { headers, signal });
	}
	throw new errors.request(`${provider.name}: generation timed out.`);
}
