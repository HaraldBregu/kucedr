import { knowledgeRoot } from '../root';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { assertKnowledgeSourceSafe } from '../safety';
import { listKnowledgeFiles } from '../list';
import { readFileBounded } from '../../files/read';
import {
	KNOWLEDGE_MAX_FILE_BYTES,
	KNOWLEDGE_MAX_FILES,
	KNOWLEDGE_MAX_TOTAL_BYTES,
} from '../limits';
import type { RagSource } from './types';

const UTF8_DECODING = new TextDecoder('utf-8', { fatal: true });

export async function* collectRagSources(
	sources: readonly string[],
	signal?: AbortSignal
): AsyncGenerator<RagSource> {
	const budget = { entries: 0, files: 0, bytes: 0 };
	let totalBytes = 0;
	let files = 0;
	for (const [sourceIndex, selected] of sources.entries()) {
		signal?.throwIfAborted();
		const source = knowledgeRoot(selected);
		if (!(await stat(source)).isDirectory())
			throw new Error('The selected source is not a folder: ' + source);
		for (const file of await listKnowledgeFiles(source, signal, budget)) {
			signal?.throwIfAborted();
			assertKnowledgeSourceSafe({ relativePath: path.join(path.basename(source), file), content: '' });
			if (++files > KNOWLEDGE_MAX_FILES) throw new Error('Knowledge source file limit exceeded.');
			const bytes = await readFileBounded(
				path.join(source, file),
				KNOWLEDGE_MAX_FILE_BYTES,
				signal
			);
			totalBytes += bytes.length;
			if (totalBytes > KNOWLEDGE_MAX_TOTAL_BYTES)
				throw new Error('Knowledge corpus byte limit exceeded.');
			if (bytes.some((byte) => byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) continue;
			let content: string;
			try {
				content = UTF8_DECODING.decode(bytes);
			} catch {
				continue;
			}
			assertKnowledgeSourceSafe({ relativePath: file, content });
			yield { source, sourceIndex, file, content };
		}
	}
}
