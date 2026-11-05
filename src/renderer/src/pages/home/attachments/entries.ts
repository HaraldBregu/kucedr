import type { LibraryFile } from '@shared/library_types';
import { workspaceFileType } from '@shared/workspace';
import { attachmentId } from './id';
import { attachmentPath } from './path';
import type { PromptAttachment } from './types';

export function libraryAttachments(files: LibraryFile[]): PromptAttachment[] {
	return files.map((entry) => {
		const file = new File([], entry.name, {
			type: workspaceFileType(entry.name).mimeType ?? '',
		});
		attachmentPath(file, entry.path);
		return {
			id: attachmentId(),
			kind: 'file' as const,
			file,
			path: entry.path,
		};
	});
}
