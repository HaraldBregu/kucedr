export const IMAGE_SOURCE_MAX_BYTES = 18 * 1024 * 1024;

export interface ImageSource {
	base64: string;
	mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface ImageRequest {
	prompt: string;
	providerId?: string;
	modelId?: string;
	source?: ImageSource;
	/** Provider-specific generation controls declared in the model metadata. */
	options?: Record<string, unknown>;
}

export interface ImageResult {
	base64: string;
	mimeType: string;
	path?: string;
}

export function normalizeImageSource(source: ImageSource | undefined): ImageSource | undefined {
	if (source === undefined) return undefined;
	if (!source || typeof source !== 'object') throw new Error('Invalid image source.');
	const mimeType = source.mimeType?.trim().toLowerCase();
	if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
		throw new Error('Unsupported image source type.');
	}
	const base64 = source.base64?.trim();
	if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
		throw new Error('Invalid image source data.');
	}
	const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
	const bytes = Math.floor((base64.length * 3) / 4) - padding;
	if (bytes > IMAGE_SOURCE_MAX_BYTES) {
		throw new Error('Image source exceeds the 18 MB limit.');
	}
	return { base64, mimeType: mimeType as ImageSource['mimeType'] };
}
