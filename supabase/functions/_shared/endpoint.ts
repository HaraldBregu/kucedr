export function endpoint(value: unknown): string | null {
	if (value == null || value === '') return null;
	if (typeof value !== 'string') throw new Error('Invalid S3 endpoint');
	const url = new URL(value);
	const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
	if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
		!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
		host.endsWith('.internal') || host.endsWith('.test') || host === '169.254.169.254' ||
		host.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
		throw new Error('Invalid S3 endpoint');
	}
	return url.toString().replace(/\/$/, '');
}
