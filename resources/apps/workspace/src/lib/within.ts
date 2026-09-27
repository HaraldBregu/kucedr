export function isWorkspacePathWithin(filePath: string, parentPath: string): boolean {
	const normalizedFilePath = filePath.replaceAll('\\', '/');
	const normalizedParentPath = parentPath.replaceAll('\\', '/').replace(/\/$/, '');
	return (
		normalizedFilePath === normalizedParentPath ||
		normalizedFilePath.startsWith(`${normalizedParentPath}/`)
	);
}
