const structuredExtensions = new Set(['json', 'jsonc', 'json5', 'toml', 'xml', 'yaml', 'yml']);

export function isStructuredDataPath(filePath: string): boolean {
	const fileName = filePath.split(/[\\/]/).pop()?.toLowerCase() ?? '';
	const extension = fileName.split('.').pop() ?? '';
	return structuredExtensions.has(extension);
}
