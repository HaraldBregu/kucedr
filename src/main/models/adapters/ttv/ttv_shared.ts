import { setTimeout as delay } from 'node:timers/promises';
import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import type { VideoGenerationResult } from './ttv_types';

const MAX_ERROR_DETAIL = 1000;
const MAX_VIDEO_BYTES = 512 * 1024 * 1024;

export async function requestJson<T>(
	providerName: string,
	url: string,
	init: RequestInit
): Promise<T> {
	const response = await fetch(url, init);
	if (response.status === 401 || response.status === 403) {
		throw new VideoProviderAuthError(`${providerName}: authentication failed.`);
	}
	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		throw new VideoProviderRequestError(
			`${providerName} request failed (${response.status}): ${detail.slice(0, MAX_ERROR_DETAIL)}`
		);
	}
	return (await response.json()) as T;
}

export async function fetchVideoAsBase64(
	url: string,
	signal?: AbortSignal,
	headers?: Record<string, string>
): Promise<VideoGenerationResult> {
	const response = await fetch(url, { signal, headers, redirect: 'follow' });
	if (!response.ok) {
		throw new VideoProviderRequestError(`Failed to download generated video (${response.status}).`);
	}
	if (Number(response.headers.get('content-length')) > MAX_VIDEO_BYTES) {
		throw new VideoProviderRequestError('Generated video exceeds the download size limit.');
	}
	const chunks: Uint8Array[] = [];
	let size = 0;
	for await (const chunk of response.body ?? []) {
		size += chunk.byteLength;
		if (size > MAX_VIDEO_BYTES) {
			throw new VideoProviderRequestError('Generated video exceeds the download size limit.');
		}
		chunks.push(chunk);
	}
	const base64 = Buffer.concat(chunks).toString('base64');
	const mimeType = response.headers.get('content-type');
	return {
		base64,
		mimeType: mimeType?.startsWith('video/') ? mimeType : 'video/mp4',
	};
}

export async function poll<T>(
	providerName: string,
	attempts: number,
	intervalMs: number,
	signal: AbortSignal | undefined,
	check: () => Promise<T | undefined>
): Promise<T> {
	for (let i = 0; i < attempts; i++) {
		const result = await check();
		if (result !== undefined) return result;
		await delay(intervalMs, undefined, { signal });
	}
	throw new VideoProviderRequestError(`${providerName}: video generation timed out.`);
}
