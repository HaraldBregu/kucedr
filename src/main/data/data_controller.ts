import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentSessionSummary } from '../../shared/agent_types';
import type {
	DataExportResult,
	DataPurgePreview,
	DataPurgeResult,
	DataScope,
} from '../../shared/data_types';
import type { Config } from '../agent/types';
import { memoryPath } from '../agent/memory';
import { MEMORY_FILE, resolveTemplatePath } from '../agent/system';
import { sessionPath, sessionsRoot } from '../agent/session';
import { purgeRagManifest } from '../agent/knowledge/rag';
import { getRagConfiguration } from '../agent/knowledge/rag/rag_store';
import { ragVectorStore } from '../agent/knowledge/rag/vector';
import { getWikiRepository, getWikiSettings } from '../agent/knowledge/wiki';
import { DataArchive } from './data_archive';
import { purgeRemoteRagNamespaces } from './data_purge_remote';

interface AgentDataPort {
	config: Config;
	listSessions(): AgentSessionSummary[];
	deleteSession(sessionId: string): Promise<void>;
}

interface PendingPurge {
	scopeHash: string;
	preview: DataPurgePreview;
}

export class DataController {
	private readonly pendingPurges = new Map<string, PendingPurge>();

	constructor(private readonly agent: AgentDataPort) {}

	listScopes(): DataScope[] {
		const scopes: DataScope[] = [{ kind: 'memory' }];
		const sessionIds = this.agent.listSessions().map((session) => session.id);
		if (sessionIds.length > 0) scopes.push({ kind: 'sessions', sessionIds });
		const wikiTarget = getWikiSettings().targetPath;
		if (wikiTarget) scopes.push({ kind: 'wiki', targetPath: wikiTarget });
		const rag = getRagConfiguration();
		const store = ragVectorStore();
		try {
			const index = store.getIndex(rag.indexName);
			if (index) {
				scopes.push({ kind: 'rag', mode: 'local_index', indexName: index.indexName });
				scopes.push({
					kind: 'rag',
					mode: 'local_namespace',
					indexName: index.indexName,
					generation: index.generation,
				});
				scopes.push({
					kind: 'rag',
					mode: 'remote_namespace',
					indexName: index.indexName,
					generation: index.generation,
				});
			}
			scopes.push({
				kind: 'rag',
				mode: 'remote_all_namespaces',
				indexName: rag.indexName,
			});
		} finally {
			store.close();
		}
		return scopes;
	}

	async export(scope: DataScope, filePath: string): Promise<DataExportResult> {
		if (
			scope.kind === 'rag' &&
			(scope.mode === 'remote_namespace' || scope.mode === 'remote_all_namespaces')
		) {
			throw new Error('Remote namespaces cannot be exported through the local data archive.');
		}
		const archive = await this.collect(scope);
		const document = {
			version: 1,
			exportedAt: new Date().toISOString(),
			scope,
			files: archive.files(),
		};
		const temporaryFile = `${filePath}.${randomUUID()}.tmp`;
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		try {
			await fs.writeFile(temporaryFile, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
			await fs.rename(temporaryFile, filePath);
		} finally {
			await fs.rm(temporaryFile, { force: true });
		}
		return { scope, filePath, files: archive.files().length, bytes: archive.bytes() };
	}

	async previewPurge(scope: DataScope): Promise<DataPurgePreview> {
		const archive =
			scope.kind === 'rag' &&
			(scope.mode === 'remote_namespace' || scope.mode === 'remote_all_namespaces')
				? new DataArchive()
				: await this.collect(scope);
		const confirmationId = randomUUID();
		const preview: DataPurgePreview = {
			confirmationId,
			scope,
			description: describeScope(scope),
			files: archive.files().length,
			bytes: archive.bytes(),
			expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
			remoteDataIncluded:
				scope.kind === 'rag' &&
				(scope.mode === 'remote_namespace' || scope.mode === 'remote_all_namespaces'),
		};
		this.pendingPurges.set(confirmationId, { scopeHash: scopeHash(scope), preview });
		return preview;
	}

	async purge(scope: DataScope, confirmationId: string): Promise<DataPurgeResult> {
		const pending = this.pendingPurges.get(confirmationId);
		this.pendingPurges.delete(confirmationId);
		if (
			!pending ||
			Date.parse(pending.preview.expiresAt) <= Date.now() ||
			pending.scopeHash !== scopeHash(scope)
		) {
			throw new Error('Purge confirmation is missing, expired, or does not match the scope.');
		}

		let remoteNamespacesDeleted = 0;
		if (scope.kind === 'rag') {
			if (scope.mode === 'remote_namespace' || scope.mode === 'remote_all_namespaces') {
				remoteNamespacesDeleted = await purgeRemoteRagNamespaces(
					scope.indexName,
					scope.mode === 'remote_namespace' ? scope.generation : undefined
				);
			} else {
				const store = ragVectorStore();
				try {
					store.purge(
						scope.indexName,
						scope.mode === 'local_namespace' ? scope.generation : undefined
					);
				} finally {
					store.close();
				}
				purgeRagManifest(
					scope.indexName,
					scope.mode === 'local_namespace' ? scope.generation : undefined
				);
			}
		} else if (scope.kind === 'wiki') {
			const repository = getWikiRepository(scope.targetPath);
			for (const page of Object.values(repository.manifest.store.pages)) {
				const pagePath = managedWikiPage(scope.targetPath, page.path);
				await fs.rm(pagePath, { force: true });
			}
			repository.sources.store = { version: 1, sources: {} };
			repository.reviews.store = { version: 1, items: [] };
			repository.operations.store = { version: 1, operations: {} };
			repository.failures.store = { version: 1, operations: [] };
			repository.manifest.store = { version: 1, pages: {} };
			repository.state.store = { sources: {} };
			await fs.rm(repository.paths.evidence, { recursive: true, force: true });
			await fs.rm(repository.paths.config, { recursive: true, force: true });
		} else if (scope.kind === 'memory') {
			const template = await fs.readFile(resolveTemplatePath(MEMORY_FILE));
			await fs.writeFile(memoryPath(this.agent.config), template);
		} else {
			for (const sessionId of scope.sessionIds) await this.agent.deleteSession(sessionId);
		}

		return {
			scope,
			files: pending.preview.files,
			bytes: pending.preview.bytes,
			remoteDataDeleted:
				scope.kind === 'rag' &&
				(scope.mode === 'remote_namespace' || scope.mode === 'remote_all_namespaces'),
			...(remoteNamespacesDeleted > 0 ? { remoteNamespacesDeleted } : {}),
		};
	}

	private async collect(scope: DataScope): Promise<DataArchive> {
		const archive = new DataArchive();
		if (scope.kind === 'rag') {
			if (scope.mode === 'remote_namespace' || scope.mode === 'remote_all_namespaces') {
				return archive;
			}
			const store = ragVectorStore();
			try {
				const publication = store.exportIndex(
					scope.indexName,
					scope.mode === 'local_namespace' ? scope.generation : undefined
				);
				if (publication) archive.addJson('rag/index.json', publication);
			} finally {
				store.close();
			}
		} else if (scope.kind === 'wiki') {
			const repository = getWikiRepository(scope.targetPath);
			for (const page of Object.values(repository.manifest.store.pages)) {
				await archive.addFile(
					managedWikiPage(scope.targetPath, page.path),
					path.join('wiki', 'pages', page.path)
				);
			}
			await archive.addTree(repository.paths.state, path.join('wiki', 'state'));
			await archive.addTree(repository.paths.evidence, path.join('wiki', 'evidence'));
			await archive.addTree(repository.paths.config, path.join('wiki', 'config'));
		} else if (scope.kind === 'memory') {
			await archive.addFile(memoryPath(this.agent.config), path.join('memory', MEMORY_FILE));
		} else {
			const available = new Set(this.agent.listSessions().map((session) => session.id));
			for (const sessionId of scope.sessionIds) {
				if (!available.has(sessionId)) throw new Error(`Assistant session not found: ${sessionId}`);
				await archive.addTree(
					sessionPath(sessionsRoot(this.agent.config.location), sessionId),
					path.join('sessions', sessionId)
				);
			}
		}
		return archive;
	}
}

function managedWikiPage(targetPath: string, pagePath: string): string {
	const root = path.resolve(targetPath);
	const resolved = path.resolve(root, pagePath);
	const relative = path.relative(root, resolved);
	if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
		throw new Error('Managed wiki page escapes the configured target.');
	}
	return resolved;
}

function scopeHash(scope: DataScope): string {
	return createHash('sha256').update(JSON.stringify(scope)).digest('hex');
}

function describeScope(scope: DataScope): string {
	if (scope.kind === 'memory') return 'all persistent memory facts';
	if (scope.kind === 'sessions') return `${scope.sessionIds.length} selected assistant session(s)`;
	if (scope.kind === 'wiki') return `managed wiki data for ${scope.targetPath}`;
	if (scope.mode === 'local_namespace') {
		return `local RAG namespace ${scope.generation} in ${scope.indexName}`;
	}
	if (scope.mode === 'remote_namespace') {
		return `remote vector database namespace ${scope.generation} in ${scope.indexName}`;
	}
	if (scope.mode === 'remote_all_namespaces') {
		return `all Kucedr-owned remote vector database namespaces in ${scope.indexName}`;
	}
	return `all local RAG data in ${scope.indexName}`;
}
