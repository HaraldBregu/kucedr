import { knowledgeRoot } from '../root';
import { lstat, stat } from 'node:fs/promises';
import path from 'node:path';
import type { RagSkipped, RagSkipReason } from '../../../../shared/rag_status';
import { isKnowledgeSourceSecret } from '../safety';
import { listKnowledgeFiles } from '../list';
import { extractText } from '../extract/extract';
import { readFileBounded } from '../../files/read';
import { KNOWLEDGE_MAX_FILE_BYTES, KNOWLEDGE_MAX_FILE_TEXT, KNOWLEDGE_MAX_FILES } from '../limits';
import type { RagSegment, RagSource } from './types';

export async function* collectRagSources(
	sources: readonly string[],
	skipped: RagSkipped[],
	signal?: AbortSignal,
	progress?: (done: number, total: number) => void
): AsyncGenerator<RagSource> {
	const budget = { entries: 0 };
	const listed: { source: string; sourceIndex: number; file: string }[] = [];
	for (const [sourceIndex, selected] of sources.entries()) {
		signal?.throwIfAborted();
		const source = knowledgeRoot(selected);
		if (!(await stat(source)).isDirectory())
			throw new Error('The selected source is not a folder: ' + source);
		for (const file of await listKnowledgeFiles(source, signal, budget, skipped))
			listed.push({ source, sourceIndex, file });
	}
	for (const [done, { source, sourceIndex, file }] of listed.entries()) {
		signal?.throwIfAborted();
		progress?.(done, listed.length);
		const shown = path.join(path.basename(source), file);
		const skip = (reason: RagSkipReason): void => void skipped.push({ path: shown, reason });
		if (done >= KNOWLEDGE_MAX_FILES) {
			skip('limit');
			continue;
		}
		if (isKnowledgeSourceSecret({ relativePath: shown, content: '' })) {
			skip('credential');
			continue;
		}
		const full = path.join(source, file);
		let segments: RagSegment[] | RagSkipReason;
		try {
			if ((await lstat(full)).size > KNOWLEDGE_MAX_FILE_BYTES) {
				skip('too-large');
				continue;
			}
			segments = await extractText(file, await readFileBounded(full, KNOWLEDGE_MAX_FILE_BYTES, signal), signal);
		} catch {
			signal?.throwIfAborted();
			skip('unreadable');
			continue;
		}
		if (typeof segments === 'string') skip(segments);
		else if (segments.reduce((length, segment) => length + segment.text.length, 0) > KNOWLEDGE_MAX_FILE_TEXT)
			skip('too-large');
		else if (!segments.some((segment) => /\S/.test(segment.text))) skip('empty');
		else if (segments.some((segment) => isKnowledgeSourceSecret({ relativePath: shown, content: segment.text })))
			skip('credential');
		else yield { source, sourceIndex, file, segments };
	}
	progress?.(listed.length, listed.length);
}
