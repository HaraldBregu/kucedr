import path from 'node:path';

const mkdirSync = jest.fn();
const readFileBoundedSync = jest.fn();
jest.mock('../../../../src/main/agent/files/read_sync', () => ({ readFileBoundedSync }));
jest.mock('../../../../src/main/agent/knowledge/root', () => ({
	knowledgeRoot: (root: string) => root,
}));
const renameSync = jest.fn();
const rmSync = jest.fn();
const writeFileSync = jest.fn();

jest.mock('node:fs', () => ({ mkdirSync, renameSync, rmSync, writeFileSync }));
jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => '/user/data',
}));

import {
	readRagManifest,
	writeRagManifest,
} from '../../../../src/main/agent/knowledge/rag/rag_manifest';

const manifest = {
	indexName: 'kucedr',
	activeNamespace: 'kucedr-a1b2c3d4',
	artifactFile: 'embeddings-kucedr-a1b2c3d4.json',
	providerId: 'openai',
	modelId: 'text-embedding-3-small',
	dimensions: 1536,
	completedAt: '2026-08-08T00:00:00.000Z',
};

it('writes a manifest per index and preserves the latest-index manifest', () => {
	writeRagManifest(manifest);

	expect(mkdirSync).toHaveBeenCalledWith(path.join('/user/data', 'rag'), {
		recursive: true,
		mode: 0o700,
	});
	const temporaryFile = writeFileSync.mock.calls[0][0] as string;
	expect(temporaryFile).toMatch(/index-kucedr\.json\..+\.tmp$/);
	expect(writeFileSync).toHaveBeenCalledWith(temporaryFile, JSON.stringify(manifest), {
		encoding: 'utf8',
		mode: 0o600,
		flag: 'wx',
	});
	expect(renameSync).toHaveBeenCalledWith(
		temporaryFile,
		path.join('/user/data/rag', 'index-kucedr.json')
	);
	expect(renameSync).toHaveBeenCalledWith(
		expect.any(String),
		path.join('/user/data/rag', 'index.json')
	);
	expect(rmSync).toHaveBeenCalledWith(temporaryFile, { force: true });
});

it('reads the RAG manifest from rag/index.json', () => {
	readFileBoundedSync.mockReturnValue({ content: Buffer.from(JSON.stringify(manifest)) });

	expect(readRagManifest()).toEqual(manifest);
	expect(readFileBoundedSync).toHaveBeenCalledWith(
		path.join('/user/data/rag', 'index.json'),
		64 * 1024
	);
});

it('reads metadata for the selected index and falls back to its legacy manifest', () => {
	readFileBoundedSync.mockImplementation((file: string) => {
		if (file.endsWith('index-kucedr.json')) throw new Error('missing');
		return { content: Buffer.from(JSON.stringify(manifest)) };
	});
	expect(readRagManifest('kucedr')).toEqual(manifest);
	expect(readRagManifest('other-index')).toBeUndefined();
});
