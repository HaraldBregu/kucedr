import type { FileAccessContext } from './context_types';

export function hasCreatedFile(
	context: FileAccessContext | undefined,
	filePath: string
): boolean {
	return context?.createdFiles.has(filePath) ?? false;
}
