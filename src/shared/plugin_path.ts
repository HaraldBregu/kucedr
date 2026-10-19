export function isPluginPath(value: unknown): value is string {
	if (typeof value !== 'string' || !value.trim() || value.includes('\\')) return false;
	const segments = value.split('/');
	return (
		!value.startsWith('/') &&
		segments.every((segment) => Boolean(segment) && segment !== '.' && segment !== '..')
	);
}
