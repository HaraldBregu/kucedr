import type { FileAccessContext, FileToolState } from './context_types';

export function rememberTool(
	context: FileAccessContext | undefined,
	state: FileToolState
): void {
	if (!context) return;
	if (state.toolName === 'read') context.readDirectories.add(state.directory);
	if (state.toolName === 'write') context.createdFiles.add(state.path);
}
