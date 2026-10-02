export function libraryFileUrl(path: string): string {
	const normalized = path.replaceAll('\\', '/');
	const url = new URL('local-resource://file/');
	url.pathname = normalized.startsWith('/') ? normalized : `/${normalized}`;
	return url.toString();
}
