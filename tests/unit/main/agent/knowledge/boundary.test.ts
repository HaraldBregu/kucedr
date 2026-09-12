import { mkdir, mkdtemp, open, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { listKnowledgeFiles } from '../../../../../src/main/agent/knowledge/list';
import { readFileBounded } from '../../../../../src/main/agent/files/read';
import {
	KNOWLEDGE_MAX_FILE_BYTES,
	KNOWLEDGE_MAX_TOTAL_BYTES,
} from '../../../../../src/main/agent/knowledge/limits';

let root: string;
beforeEach(async () => {
	root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'kucedr-knowledge-boundary-')));
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

it('rejects sparse oversized files and aggregate trees before allocating their contents', async () => {
	const file = path.join(root, 'large.md');
	const handle = await open(file, 'w');
	await handle.truncate(KNOWLEDGE_MAX_FILE_BYTES + 1);
	await handle.close();
	await expect(readFileBounded(file, KNOWLEDGE_MAX_FILE_BYTES)).rejects.toThrow('byte limit');
	const huge = await open(file, 'w');
	await huge.truncate(KNOWLEDGE_MAX_TOTAL_BYTES + 1);
	await huge.close();
	await expect(listKnowledgeFiles(root)).rejects.toThrow('corpus byte limit');
});

it('honors cancellation while reading the knowledge corpus', async () => {
	const controller = new AbortController();
	controller.abort(new Error('stopped'));
	await expect(readFileBounded(path.join(root, 'page.md'), 100, controller.signal)).rejects.toThrow(
		'stopped'
	);
	await expect(listKnowledgeFiles(root, controller.signal)).rejects.toThrow('stopped');
});

it('bounds depth and cumulative traversal across source folders', async () => {
	await mkdir(path.join(root, ...Array(13).fill('nested')), { recursive: true });
	await expect(listKnowledgeFiles(root)).rejects.toThrow('depth limit');
	await expect(
		listKnowledgeFiles(root, undefined, { entries: 10000, files: 0, bytes: 0 })
	).rejects.toThrow('entry limit');
});
