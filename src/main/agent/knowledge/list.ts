import type { RagSkipped } from '../../../shared/rag_status';
import type { KnowledgeScanBudget } from './types';
import { knowledgeRoot } from './root';
import { lstat, opendir } from 'node:fs/promises';
import path from 'node:path';
import { validateFilePath } from '../files/validate';
import { KNOWLEDGE_MAX_DEPTH, KNOWLEDGE_MAX_ENTRIES } from './limits';

export async function listKnowledgeFiles(
	root: string,
	signal?: AbortSignal,
	budget: KnowledgeScanBudget = { entries: 0 },
	skipped: RagSkipped[] = []
): Promise<string[]> {
	signal?.throwIfAborted();
	let canonicalRoot: string;
	try {
		canonicalRoot = knowledgeRoot(root);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}
	const pending = [{ relative: '', depth: 0 }];
	const files: string[] = [];
	if (++budget.entries > KNOWLEDGE_MAX_ENTRIES)
		throw new Error('Knowledge folder exceeds the entry limit.');
	while (pending.length > 0) {
		signal?.throwIfAborted();
		const current = pending.pop()!;
		if (current.depth > KNOWLEDGE_MAX_DEPTH)
			throw new Error('Knowledge folder exceeds the depth limit.');
		const directory = path.join(canonicalRoot, current.relative);
		const identity = JSON.stringify(validateFilePath(directory));
		const handle = await opendir(directory);
		for await (const entry of handle) {
			signal?.throwIfAborted();
			if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
			if (++budget.entries > KNOWLEDGE_MAX_ENTRIES)
				throw new Error('Knowledge folder exceeds the entry limit.');
			const relative = path.join(current.relative, entry.name);
			const stat = await lstat(path.join(canonicalRoot, relative));
			if (stat.isSymbolicLink())
				skipped.push({ path: path.join(path.basename(canonicalRoot), relative), reason: 'symlink' });
			else if (stat.isDirectory()) pending.push({ relative, depth: current.depth + 1 });
			else if (stat.isFile()) files.push(relative);
			if (JSON.stringify(validateFilePath(directory)) !== identity)
				throw new Error('Knowledge directory changed while listing.');
		}
	}
	return files.sort();
}
