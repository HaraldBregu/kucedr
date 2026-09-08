import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { RagConfiguration } from '../../../../src/shared/rag_types';
import type { RagMirror, VectorStore } from '../../../../src/main/agent/knowledge/rag/types';

const getRagConfiguration = jest.fn();
const writeRagManifest = jest.fn();
const getProvider = jest.fn();
jest.mock('../../../../src/main/agent/knowledge/rag/rag_store', () => ({ getRagConfiguration }));
jest.mock('../../../../src/main/agent/knowledge/rag/rag_manifest', () => ({ writeRagManifest }));
jest.mock('../../../../src/main/settings_store', () => ({ getProvider }));

import { indexRag } from '../../../../src/main/agent/knowledge/rag/rag_index';
import { authorizeRagDisclosure } from '../../../../src/main/agent/knowledge/rag/disclosure';

const embed = jest.fn();
const upload = jest.fn();
const discard = jest.fn();
const mirror: RagMirror = { upload, discard };
const publish = jest.fn();
const reusable = jest.fn();
const vectors: VectorStore = {
	getIndex: jest.fn(),
	getReusableSource: reusable,
	publish,
	search: jest.fn(),
	exportIndex: jest.fn(),
	purge: jest.fn(),
	close: jest.fn(),
};
let root: string;
let configuration: RagConfiguration;

beforeEach(async () => {
	jest.resetAllMocks();
	root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'kucedr-rag-index-')));
	await writeFile(path.join(root, 'guide.md'), '# Guide');
	getProvider.mockImplementation((_id, kind) => ({
		apiKey: kind === 'databases' ? 'synthetic-mirror-account' : 'synthetic-embedding-account',
	}));
	configuration = authorizeRagDisclosure({
		enabled: true,
		indexName: 'knowledge-base',
		databaseId: 'pinecone',
		databaseProviderId: 'pinecone',
		embeddingProviderId: 'openai',
		embeddingModelId: 'test-model',
		embeddingConsent: { providerId: 'openai', modelId: 'test-model', version: 1 },
		mirrorConsent: { indexName: 'knowledge-base', version: 1 },
		folders: [root],
		scheduleEnabled: false,
		cronExpression: '0 3 * * *',
	});
	getRagConfiguration.mockImplementation(() => configuration);
	embed.mockImplementation(async (input) => ({
		providerId: input.providerId,
		modelId: input.modelId,
		dimensions: 2,
		embeddings: input.texts.map(() => [0.1, 0.2]),
	}));
	upload.mockResolvedValue(undefined);
	discard.mockResolvedValue(undefined);
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

it('publishes locally only after the authorized mirror finishes', async () => {
	await expect(
		indexRag([root], 'knowledge-base', { embeddings: { embed }, vectors, mirror })
	).resolves.toEqual({ files: 1, vectors: 1 });
	const publication = publish.mock.calls[0][0];
	expect(upload).toHaveBeenCalledWith(
		'knowledge-base',
		publication.generation,
		2,
		expect.arrayContaining([expect.objectContaining({ text: '# Guide', vector: [0.1, 0.2] })]),
		expect.any(AbortSignal)
	);
	expect(writeRagManifest).toHaveBeenCalledWith(
		expect.objectContaining({ activeNamespace: publication.generation })
	);
	expect(discard).not.toHaveBeenCalled();
});

it('blocks indexing before document export when the database selection is removed', async () => {
	configuration.databaseProviderId = '';
	configuration.databaseId = '';
	await expect(
		indexRag([root], 'knowledge-base', { embeddings: { embed }, vectors, mirror })
	).rejects.toThrow('Select a vector database');
	expect(embed).not.toHaveBeenCalled();
	expect(upload).not.toHaveBeenCalled();
	expect(publish).not.toHaveBeenCalled();
});

it.each(['embedding', 'mirror', 'account', 'model', 'index'])(
	'blocks unapproved or changed %s disclosure before any export',
	async (change) => {
		if (change === 'embedding')
			configuration.embeddingConsent = { providerId: 'openai', modelId: 'test-model' };
		if (change === 'mirror') configuration.mirrorConsent = null;
		if (change === 'account') getProvider.mockReturnValue({ apiKey: 'different-account' });
		if (change === 'model') configuration.embeddingModelId = 'changed-model';
		await expect(
			indexRag([root], change === 'index' ? 'changed-index' : 'knowledge-base', {
				embeddings: { embed },
				vectors,
				mirror,
			})
		).rejects.toThrow(/Confirm/);
		expect(embed).not.toHaveBeenCalled();
		expect(upload).not.toHaveBeenCalled();
		expect(publish).not.toHaveBeenCalled();
	}
);

it.each([
	'{"api_key":"abcdefghijklmnopqrstuvwxyz123456"}',
	'sk-abcdefghijklmnopqrstuvwxyz123456',
	'-----BEGIN PRIVATE KEY-----',
	'Authorization: Bearer syntheticcredential1234',
])('rejects synthetic secrets before export', async (content) => {
	await writeFile(path.join(root, 'guide.md'), content);
	await expect(
		indexRag([root], 'knowledge-base', { embeddings: { embed }, vectors, mirror })
	).rejects.toThrow('credential-like');
	expect(embed).not.toHaveBeenCalled();
	expect(upload).not.toHaveBeenCalled();
});

it('reads nested and extensionless text while excluding binary content', async () => {
	await mkdir(path.join(root, 'nested'));
	await writeFile(path.join(root, 'nested', 'README'), 'Nested notes');
	await writeFile(path.join(root, 'binary'), Buffer.from([0, 255]));
	await expect(
		indexRag([root], 'knowledge-base', { embeddings: { embed }, vectors, mirror })
	).resolves.toEqual({ files: 2, vectors: 2 });
});

it('cleans only the current failed staging namespace and keeps the published index untouched', async () => {
	upload.mockRejectedValue(new Error('partial upload failed'));
	await expect(
		indexRag([root], 'knowledge-base', { embeddings: { embed }, vectors, mirror })
	).rejects.toThrow('partial upload failed');
	expect(discard).toHaveBeenCalledWith(
		'knowledge-base',
		upload.mock.calls[0][1],
		expect.any(AbortSignal)
	);
	expect(publish).not.toHaveBeenCalled();
	expect(writeRagManifest).not.toHaveBeenCalled();
});

it('cleans a cancelled upload using a fresh cleanup signal', async () => {
	const controller = new AbortController();
	upload.mockImplementation(async () => controller.abort(new Error('cancelled')));
	await expect(
		indexRag([root], 'knowledge-base', {
			embeddings: { embed },
			vectors,
			mirror,
			signal: controller.signal,
		})
	).rejects.toThrow('cancelled');
	expect(discard.mock.calls[0][2].aborted).toBe(false);
	expect(publish).not.toHaveBeenCalled();
});

it('does not remove a successfully published generation when manifest persistence fails', async () => {
	writeRagManifest.mockImplementation(() => {
		throw new Error('disk full');
	});
	await expect(
		indexRag([root], 'knowledge-base', { embeddings: { embed }, vectors, mirror })
	).rejects.toThrow('disk full');
	expect(publish).toHaveBeenCalled();
	expect(discard).not.toHaveBeenCalled();
});

it('stops when consent is revoked between embedding batches and publication', async () => {
	embed.mockImplementation(async () => {
		configuration.mirrorConsent = null;
		return { providerId: 'openai', modelId: 'test-model', dimensions: 2, embeddings: [[1, 2]] };
	});
	await expect(
		indexRag([root], 'knowledge-base', { embeddings: { embed }, vectors, mirror })
	).rejects.toThrow('Confirm Pinecone');
	expect(upload).not.toHaveBeenCalled();
});
