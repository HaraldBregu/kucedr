export function workspaceResourceUrl(source: string, markdownPath: string): string {
	const normalizedSource = source.trim().replaceAll('\\', '/');
	if (
		!normalizedSource ||
		normalizedSource.startsWith('/') ||
		/^[a-z][a-z\d+.-]*:/i.test(normalizedSource)
	) {
		return '';
	}

	let decodedPath: string;
	try {
		decodedPath = decodeURIComponent(normalizedSource.split(/[?#]/, 1)[0]);
	} catch {
		return '';
	}

	const segments = markdownPath.replaceAll('\\', '/').split('/');
	segments.pop();
	for (const segment of decodedPath.split('/')) {
		if (!segment || segment === '.') continue;
		if (segment === '..') {
			if (segments.length === 0) return '';
			segments.pop();
		} else {
			segments.push(segment);
		}
	}
	if (segments.length === 0) return '';

	const url = new URL('local-resource://agent/');
	url.pathname = `/${segments.join('/')}`;
	return url.toString();
}
