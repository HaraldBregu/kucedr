import type { A2aAgent } from '../../../shared/a2a_types';

export function sanitizeA2aError(
	error: unknown,
	authentication?: Pick<A2aAgent, 'credential'>
): Error {
	const record =
		typeof error === 'object' && error !== null ? (error as { message?: unknown; name?: unknown }) : {};
	let message =
		error instanceof Error
			? error.message
			: typeof record.message === 'string'
				? record.message
				: String(error);
	const name =
		error instanceof Error
			? error.name
			: typeof record.name === 'string'
				? record.name
				: 'Error';
	const credential = authentication?.credential;
	if (credential) {
		message = message.replaceAll(credential, '[REDACTED]');
		message = message.replaceAll(encodeURIComponent(credential.toWellFormed()), '[REDACTED]');
	}
	const sanitized = new Error(message.slice(0, 2_000));
	sanitized.name = name;
	return sanitized;
}
