export function rebaseWorkspacePath(
	filePath: string,
	sourcePath: string,
	destinationPath: string
): string {
	const normalizedFilePath = filePath.replaceAll('\\', '/');
	const normalizedSourcePath = sourcePath.replaceAll('\\', '/');
	if (normalizedFilePath === normalizedSourcePath) return destinationPath;
	return `${destinationPath}${normalizedFilePath.slice(normalizedSourcePath.length)}`;
}
