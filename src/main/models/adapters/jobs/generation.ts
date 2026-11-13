type Job = {
	id?: string;
	status?: string;
	output?: { audio?: { url?: string }; video?: { url?: string } };
	error?: string | { message?: string };
};

export async function generateJobMedia(
	provider: { name: string; apiKey: string; baseURL: string },
	path: string,
	body: Record<string, unknown>,
	errors: { auth: new (message: string) => Error; request: new (message: string) => Error },
	signal?: AbortSignal
): Promise<{ base64: string; mimeType: string }> {
	const baseURL = provider.baseURL.replace(/\/v1\/?$/, '');
	const headers = { 'X-API-Key': provider.apiKey, 'Content-Type': 'application/json' };
	let response = await fetch(`${baseURL}/v1/media/${path}`, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
		signal,
	});
	let job: Job;
	for (let attempt = 0; attempt < 120; attempt++) {
		if (response.status === 401 || response.status === 403)
			throw new errors.auth(`${provider.name}: authentication failed.`);
		if (!response.ok)
			throw new errors.request(
				`${provider.name} request failed (${response.status}): ${await response.text()}`
			);
		job = (await response.json()) as Job;
		if (job.status === 'failed')
			throw new errors.request(
				`${provider.name}: ${typeof job.error === 'string' ? job.error : (job.error?.message ?? 'generation failed')}`
			);
		if (job.status === 'completed') {
			const url = job.output?.audio?.url ?? job.output?.video?.url;
			if (!url) throw new errors.request(`${provider.name}: result contained no media.`);
			const media = await fetch(url, { signal });
			if (!media.ok)
				throw new errors.request(`${provider.name}: could not download media (${media.status}).`);
			return {
				base64: Buffer.from(await media.arrayBuffer()).toString('base64'),
				mimeType: media.headers.get('content-type') ?? 'audio/mpeg',
			};
		}
		if (!job.id) throw new errors.request(`${provider.name}: generation was not accepted.`);
		signal?.throwIfAborted();
		if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 5000));
		response = await fetch(`${baseURL}/v1/media/jobs/${encodeURIComponent(job.id)}`, {
			headers,
			signal,
		});
	}
	throw new errors.request(`${provider.name}: generation timed out.`);
}
