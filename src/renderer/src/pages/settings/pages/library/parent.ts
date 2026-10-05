export function libraryParent(relativePath: string): string {
	return relativePath.replaceAll('\\', '/').split('/').slice(0, -1).join('/');
}
