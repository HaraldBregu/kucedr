import type { AgentInputFile } from '@/lib/compat';
import { attachmentPath } from '../attachments/path';

export async function filesToAgentInput(files: File[]): Promise<AgentInputFile[]> {
	return Promise.all(
		files.map(async (file) => {
			const path = attachmentPath(file);
			const bytes = new Uint8Array(
				file.size === 0 && path ? await window.agent.readPromptFile(path) : await file.arrayBuffer()
			);
			let binary = '';
			const chunkSize = 0x8000;

			for (let offset = 0; offset < bytes.length; offset += chunkSize) {
				binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
			}

			return {
				name: file.name,
				mimeType: file.type || 'application/octet-stream',
				data: btoa(binary),
				...(attachmentPath(file) ? { path: attachmentPath(file) } : {}),
			};
		})
	);
}
