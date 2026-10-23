export function workspaceResourceUrl(documentPath: string, src: string): string {
	const base = new URL('local-resource://agent/');
	base.pathname = `/${documentPath.replaceAll('\\', '/')}`;
	return new URL(src, base).toString();
}
