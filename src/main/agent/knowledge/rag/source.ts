import { knowledgeRoot } from '../root';
import { lstat, stat } from 'node:fs/promises';
import path from 'node:path';
import type { RagSkipped, RagSkipReason } from '../../../../shared/rag_status';
import { isKnowledgeSourceSecret } from '../safety';
import { listKnowledgeFiles } from '../list';
import { extractText } from '../extract/extract';
import { readFileBounded } from '../../files/read';
import {
	KNOWLEDGE_EXTRACT_CONCURRENCY,
	KNOWLEDGE_MAX_FILE_BYTES,
	KNOWLEDGE_MAX_FILE_TEXT,
	KNOWLEDGE_MAX_FILES,
} from '../limits';
import type { RagSegment, RagSource } from './types';

export async function* collectRagSources(
	sources: readonly string[],
	skipped: RagSkipped[],
	signal?: AbortSignal,
	progress?: (done: number, total: number) => void,
	unchanged?: (source: string, file: string, size: number, modified: number) => boolean
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
	const load = async (position: number): Promise<RagSource | RagSkipReason> => {
		const { source, sourceIndex, file } = listed[position];
		const shown = path.join(path.basename(source), file);
		if (position >= KNOWLEDGE_MAX_FILES) return 'limit';
		if (isKnowledgeSourceSecret({ relativePath: shown, content: '' })) return 'credential';
		const full = path.join(source, file);
		let size: number;
		let modified: number;
		let segments: RagSegment[] | RagSkipReason;
		try {
			({ size, mtimeMs: modified } = await lstat(full));
			if (size > KNOWLEDGE_MAX_FILE_BYTES) return 'too-large';
			if (unchanged?.(source, file, size, modified))
				return { source, sourceIndex, file, size, modified };
			segments = await extractText(
				file,
				await readFileBounded(full, KNOWLEDGE_MAX_FILE_BYTES, signal),
				signal
			);
		} catch {
			signal?.throwIfAborted();
			return 'unreadable';
		}
		if (typeof segments === 'string') return segments;
		if (
			segments.reduce((length, segment) => length + segment.text.length, 0) >
			KNOWLEDGE_MAX_FILE_TEXT
		)
			return 'too-large';
		if (!segments.some((segment) => /\S/.test(segment.text))) return 'empty';
		if (
			segments.some((segment) =>
				isKnowledgeSourceSecret({ relativePath: shown, content: segment.text })
			)
		)
			return 'credential';
		return { source, sourceIndex, file, size, modified, segments };
	};
	const loading: Promise<RagSource | RagSkipReason>[] = [];
	for (let done = 0; done < listed.length; done += 1) {
		while (loading.length < KNOWLEDGE_EXTRACT_CONCURRENCY && done + loading.length < listed.length) {
			const task = load(done + loading.length);
			task.catch(() => undefined);
			loading.push(task);
		}
		signal?.throwIfAborted();
		progress?.(done, listed.length);
		const loaded = await (loading.shift() as Promise<RagSource | RagSkipReason>);
		if (typeof loaded !== 'string') yield loaded;
		else
			skipped.push({
				path: path.join(path.basename(listed[done].source), listed[done].file),
				reason: loaded,
			});
	}
	progress?.(listed.length, listed.length);
}
