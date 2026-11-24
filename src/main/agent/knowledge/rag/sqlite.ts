import { restrictSettingsFile } from '../../../shared/restrict_settings_file';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { validateVector } from './validate';
import { ftsQuery } from './terms';
import type {
	IndexRow,
	RecordRow,
	VectorChunk,
	VectorHit,
	VectorIndex,
	VectorPublication,
	VectorRecord,
	VectorSource,
	VectorStore,
} from './types';

const ACTIVE = `
	FROM rag_chunks c
	JOIN rag_indexes i
		ON i.index_name = c.index_name AND i.active_generation = c.generation`;
const CHUNK_COLUMNS = `c.id, c.source_id, c.source_fingerprint, c.path, c.chunk_index,
	c.line_start, c.line_end, c.text, c.checksum, c.indexed_at`;

interface Matrix {
	key: string;
	ids: string[];
	dimensions: number;
	values: Float32Array;
}

export class SqliteVectorStore implements VectorStore {
	private readonly database: DatabaseSync;
	private readonly getIndexStatement: StatementSync;
	private readonly reusableSourceStatement: StatementSync;
	private readonly reusableCountStatement: StatementSync;
	private readonly activeRecordsStatement: StatementSync;
	private readonly activeVectorsStatement: StatementSync;
	private readonly activeCountStatement: StatementSync;
	private readonly pathsStatement: StatementSync;
	private readonly chunksStatement: StatementSync;
	private readonly neighboursStatement: StatementSync;
	private readonly keywordStatement: StatementSync;
	private readonly sourceStatement: StatementSync;
	private readonly insertSourceStatement: StatementSync;
	private readonly deleteSourcesStatement: StatementSync;
	private readonly insertRecordStatement: StatementSync;
	private readonly reuseRecordsStatement: StatementSync;
	private readonly publishIndexStatement: StatementSync;
	private readonly deleteOldRecordsStatement: StatementSync;
	private matrix: Matrix | undefined;

	constructor(file: string) {
		if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
		this.database = new DatabaseSync(file);
		if (file !== ':memory:') restrictSettingsFile(file);
		this.database.exec(`
			PRAGMA journal_mode = WAL;
			PRAGMA foreign_keys = ON;
			CREATE TABLE IF NOT EXISTS rag_indexes (
				index_name TEXT PRIMARY KEY,
				active_generation TEXT NOT NULL,
				provider_id TEXT NOT NULL,
				model_id TEXT NOT NULL,
				dimensions INTEGER NOT NULL CHECK (dimensions > 0),
				completed_at TEXT NOT NULL
			) STRICT;
			CREATE TABLE IF NOT EXISTS rag_chunks (
				index_name TEXT NOT NULL,
				generation TEXT NOT NULL,
				id TEXT NOT NULL,
				source_id TEXT NOT NULL,
				source_fingerprint TEXT NOT NULL,
				path TEXT NOT NULL,
				chunk_index INTEGER NOT NULL,
				line_start INTEGER NOT NULL,
				line_end INTEGER NOT NULL,
				text TEXT NOT NULL,
				checksum TEXT NOT NULL,
				indexed_at TEXT NOT NULL,
				vector BLOB NOT NULL,
				PRIMARY KEY (index_name, generation, id)
			) STRICT;
			CREATE INDEX IF NOT EXISTS rag_chunks_source
				ON rag_chunks (index_name, generation, source_id, source_fingerprint);
			CREATE TABLE IF NOT EXISTS rag_sources (
				index_name TEXT NOT NULL,
				source_id TEXT NOT NULL,
				size INTEGER NOT NULL,
				modified REAL NOT NULL,
				stamp TEXT NOT NULL,
				fingerprint TEXT NOT NULL,
				PRIMARY KEY (index_name, source_id)
			) STRICT;
			CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(text, content='rag_chunks');
		`);
		const columns = new Set(
			(
				this.database.prepare('PRAGMA table_info(rag_chunks)').all() as unknown as Array<{
					name: string;
				}>
			).map((column) => column.name)
		);
		if (!columns.has('line_start')) {
			this.database.exec('ALTER TABLE rag_chunks ADD COLUMN line_start INTEGER NOT NULL DEFAULT 1');
		}
		if (!columns.has('line_end')) {
			this.database.exec('ALTER TABLE rag_chunks ADD COLUMN line_end INTEGER NOT NULL DEFAULT 1');
		}
		this.getIndexStatement = this.database.prepare(`
			SELECT index_name, active_generation, provider_id, model_id, dimensions, completed_at
			FROM rag_indexes WHERE index_name = ?
		`);
		this.reusableSourceStatement = this.database.prepare(`
			SELECT ${CHUNK_COLUMNS}, c.vector ${ACTIVE}
			WHERE c.index_name = ? AND c.source_id = ? AND c.source_fingerprint = ?
				AND i.provider_id = ? AND i.model_id = ?
			ORDER BY c.chunk_index
		`);
		this.reusableCountStatement = this.database.prepare(`
			SELECT count(*) AS count ${ACTIVE}
			WHERE c.index_name = ? AND c.source_id = ? AND c.source_fingerprint = ?
				AND i.provider_id = ? AND i.model_id = ?
		`);
		this.activeRecordsStatement = this.database.prepare(
			`SELECT ${CHUNK_COLUMNS}, c.vector ${ACTIVE} WHERE c.index_name = ?`
		);
		this.activeVectorsStatement = this.database.prepare(
			`SELECT c.id, c.vector ${ACTIVE} WHERE c.index_name = ?`
		);
		this.activeCountStatement = this.database.prepare(
			`SELECT count(*) AS count ${ACTIVE} WHERE c.index_name = ?`
		);
		this.chunksStatement = this.database.prepare(`
			SELECT ${CHUNK_COLUMNS} ${ACTIVE}
			WHERE c.index_name = ? AND c.id IN (SELECT value FROM json_each(?))
		`);
		this.neighboursStatement = this.database.prepare(`
			SELECT ${CHUNK_COLUMNS} ${ACTIVE}
			WHERE c.index_name = ? AND c.source_id = ? AND c.chunk_index BETWEEN ? AND ?
			ORDER BY c.chunk_index
		`);
		this.keywordStatement = this.database.prepare(`
			SELECT c.id FROM rag_chunks_fts f
			JOIN rag_chunks c ON c.rowid = f.rowid
			JOIN rag_indexes i
				ON i.index_name = c.index_name AND i.active_generation = c.generation
			WHERE rag_chunks_fts MATCH ? AND c.index_name = ?
			ORDER BY f.rank LIMIT ?
		`);
		this.sourceStatement = this.database.prepare(`
			SELECT source_id, size, modified, stamp, fingerprint
			FROM rag_sources WHERE index_name = ? AND source_id = ?
		`);
		this.insertSourceStatement = this.database.prepare(`
			INSERT INTO rag_sources (index_name, source_id, size, modified, stamp, fingerprint)
			VALUES (?, ?, ?, ?, ?, ?)
		`);
		this.deleteSourcesStatement = this.database.prepare(
			'DELETE FROM rag_sources WHERE index_name = ?'
		);
		this.insertRecordStatement = this.database.prepare(`
			INSERT INTO rag_chunks (
				index_name, generation, id, source_id, source_fingerprint, path, chunk_index,
				line_start, line_end, text, checksum, indexed_at, vector
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);
		this.reuseRecordsStatement = this.database.prepare(`
			UPDATE rag_chunks SET generation = ?
			WHERE index_name = ? AND generation = ? AND source_id = ? AND source_fingerprint = ?
		`);
		this.publishIndexStatement = this.database.prepare(`
			INSERT INTO rag_indexes (
				index_name, active_generation, provider_id, model_id, dimensions, completed_at
			) VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(index_name) DO UPDATE SET
				active_generation = excluded.active_generation,
				provider_id = excluded.provider_id,
				model_id = excluded.model_id,
				dimensions = excluded.dimensions,
				completed_at = excluded.completed_at
		`);
		this.deleteOldRecordsStatement = this.database.prepare(
			'DELETE FROM rag_chunks WHERE index_name = ? AND generation <> ?'
		);
	}

	getIndex(indexName: string): VectorIndex | undefined {
		const row = this.getIndexStatement.get(indexName) as unknown as IndexRow | undefined;
		return row ? mapIndex(row) : undefined;
	}

	getReusableSource(
		indexName: string,
		sourceId: string,
		sourceFingerprint: string,
		providerId: string,
		modelId: string
	): VectorRecord[] | undefined {
		const rows = this.reusableSourceStatement.all(
			indexName,
			sourceId,
			sourceFingerprint,
			providerId,
			modelId
		) as unknown as RecordRow[];
		return rows.length > 0 ? rows.map(mapRecord) : undefined;
	}

	reusable(
		indexName: string,
		sourceId: string,
		sourceFingerprint: string,
		providerId: string,
		modelId: string
	): number {
		const row = this.reusableCountStatement.get(
			indexName,
			sourceId,
			sourceFingerprint,
			providerId,
			modelId
		) as unknown as { count: number };
		return row.count;
	}

	source(indexName: string, sourceId: string): VectorSource | undefined {
		const row = this.sourceStatement.get(indexName, sourceId) as unknown as
			| {
					source_id: string;
					size: number;
					modified: number;
					stamp: string;
					fingerprint: string;
			  }
			| undefined;
		return row
			? {
					sourceId: row.source_id,
					size: row.size,
					modified: row.modified,
					stamp: row.stamp,
					fingerprint: row.fingerprint,
				}
			: undefined;
	}

	publish(publication: VectorPublication): void {
		const reused = publication.reused ?? [];
		if (publication.records.length === 0 && reused.length === 0)
			throw new Error('Cannot publish an empty vector index.');
		for (const record of publication.records) {
			validateVector(record.vector, publication.dimensions);
		}

		this.database.exec('BEGIN IMMEDIATE');
		try {
			const active = this.getIndex(publication.indexName);
			for (const record of publication.records) {
				this.insertRecordStatement.run(
					publication.indexName,
					publication.generation,
					record.id,
					record.sourceId,
					record.sourceFingerprint,
					record.path,
					record.chunkIndex,
					record.lineStart,
					record.lineEnd,
					record.text,
					record.checksum,
					record.indexedAt,
					encodeVector(record.vector)
				);
			}
			for (const source of reused) {
				if (
					!active ||
					active.dimensions !== publication.dimensions ||
					this.reuseRecordsStatement.run(
						publication.generation,
						publication.indexName,
						active.generation,
						source.sourceId,
						source.sourceFingerprint
					).changes === 0
				)
					throw new Error('A reused Knowledge source is no longer in the active index.');
			}
			this.publishIndexStatement.run(
				publication.indexName,
				publication.generation,
				publication.providerId,
				publication.modelId,
				publication.dimensions,
				publication.completedAt
			);
			this.deleteOldRecordsStatement.run(publication.indexName, publication.generation);
			this.deleteSourcesStatement.run(publication.indexName);
			for (const source of publication.sources ?? [])
				this.insertSourceStatement.run(
					publication.indexName,
					source.sourceId,
					source.size,
					source.modified,
					source.stamp,
					source.fingerprint
				);
			this.database.exec(`INSERT INTO rag_chunks_fts(rag_chunks_fts) VALUES('rebuild')`);
			this.database.exec('COMMIT');
		} catch (error) {
			this.database.exec('ROLLBACK');
			throw error;
		}
	}

	search(indexName: string, vector: readonly number[], topK: number): VectorHit[] {
		const index = this.getIndex(indexName);
		if (!index) return [];
		if (vector.length !== index.dimensions)
			throw new Error('Query vector dimensions do not match.');
		validateVector(vector, index.dimensions);
		if (!Number.isFinite(topK)) throw new Error('Knowledge result count must be finite.');
		const count = Math.max(1, Math.min(Math.trunc(topK), 100));
		const { ids, dimensions, values } = this.load(index);
		const query = normalize(Float32Array.from(vector));
		const hits: VectorHit[] = [];
		for (let row = 0; row < ids.length; row += 1) {
			let score = 0;
			const offset = row * dimensions;
			for (let column = 0; column < dimensions; column += 1)
				score += values[offset + column] * query[column];
			if (hits.length < count || score >= hits[hits.length - 1].score) {
				hits.push({ id: ids[row], score });
				hits.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
				if (hits.length > count) hits.pop();
			}
		}
		return hits;
	}

	keyword(indexName: string, query: string, topK: number): string[] {
		const match = ftsQuery(query);
		if (!match) return [];
		const rows = this.keywordStatement.all(
			match,
			indexName,
			Math.max(1, Math.min(Math.trunc(topK), 100))
		) as unknown as Array<{ id: string }>;
		return rows.map((row) => row.id);
	}

	chunks(indexName: string, ids: readonly string[]): VectorChunk[] {
		if (ids.length === 0) return [];
		const rows = this.chunksStatement.all(indexName, JSON.stringify(ids)) as unknown as Omit<
			RecordRow,
			'vector'
		>[];
		const byId = new Map(rows.map((row) => [row.id, mapChunk(row)]));
		return ids.flatMap((id) => byId.get(id) ?? []);
	}

	around(indexName: string, id: string, span: number): VectorChunk[] {
		const [chunk] = this.chunks(indexName, [id]);
		if (!chunk) return [];
		const rows = this.neighboursStatement.all(
			indexName,
			chunk.sourceId,
			chunk.chunkIndex - span,
			chunk.chunkIndex + span
		) as unknown as Omit<RecordRow, 'vector'>[];
		return rows.map(mapChunk);
	}

	summary(indexName: string): { chunks: number; paths: string[] } {
		const { count } = this.activeCountStatement.get(indexName) as unknown as { count: number };
		const rows = this.pathsStatement.all(indexName) as unknown as Array<{ path: string }>;
		return { chunks: count, paths: rows.map((row) => row.path) };
	}

	exportIndex(indexName: string, generation?: string): VectorPublication | undefined {
		const index = this.getIndex(indexName);
		if (!index || (generation && generation !== index.generation)) return undefined;
		const rows = this.activeRecordsStatement.all(indexName) as unknown as RecordRow[];
		return { ...index, records: rows.map(mapRecord) };
	}

	purge(indexName: string, generation?: string): { records: number; indexRemoved: boolean } {
		const index = this.getIndex(indexName);
		if (!index || (generation && generation !== index.generation)) {
			return { records: 0, indexRemoved: false };
		}
		this.database.exec('BEGIN IMMEDIATE');
		try {
			const records = generation
				? this.database
						.prepare('DELETE FROM rag_chunks WHERE index_name = ? AND generation = ?')
						.run(indexName, generation).changes
				: this.database.prepare('DELETE FROM rag_chunks WHERE index_name = ?').run(indexName)
						.changes;
			const indexRemoved =
				this.database.prepare('DELETE FROM rag_indexes WHERE index_name = ?').run(indexName)
					.changes > 0;
			this.deleteSourcesStatement.run(indexName);
			this.database.exec(`INSERT INTO rag_chunks_fts(rag_chunks_fts) VALUES('rebuild')`);
			this.database.exec('COMMIT');
			return { records: Number(records), indexRemoved };
		} catch (error) {
			this.database.exec('ROLLBACK');
			throw error;
		}
	}

	warm(indexName: string): void {
		const index = this.getIndex(indexName);
		if (index) this.load(index);
	}

	close(): void {
		this.matrix = undefined;
		this.database.close();
	}

	private load({ indexName, generation, completedAt, dimensions }: VectorIndex): Matrix {
		const key = `${indexName}\0${generation}\0${completedAt}`;
		if (this.matrix?.key === key) return this.matrix;
		this.matrix = undefined;
		const { count } = this.activeCountStatement.get(indexName) as unknown as { count: number };
		const ids: string[] = [];
		const values = new Float32Array(count * dimensions);
		for (const row of this.activeVectorsStatement.iterate(indexName) as Iterable<{
			id: string;
			vector: Uint8Array;
		}>) {
			if (ids.length === count) break;
			const vector = new Float32Array(Uint8Array.from(row.vector).buffer);
			if (vector.length !== dimensions) continue;
			values.set(normalize(vector), ids.length * dimensions);
			ids.push(row.id);
		}
		this.matrix = { key, ids, dimensions, values: values.subarray(0, ids.length * dimensions) };
		return this.matrix;
	}
}

function mapIndex(row: IndexRow): VectorIndex {
	return {
		indexName: row.index_name,
		generation: row.active_generation,
		providerId: row.provider_id,
		modelId: row.model_id,
		dimensions: row.dimensions,
		completedAt: row.completed_at,
	};
}

function mapChunk(row: Omit<RecordRow, 'vector'>): VectorChunk {
	return {
		id: row.id,
		sourceId: row.source_id,
		sourceFingerprint: row.source_fingerprint,
		path: row.path,
		chunkIndex: row.chunk_index,
		lineStart: row.line_start,
		lineEnd: row.line_end,
		text: row.text,
		checksum: row.checksum,
		indexedAt: row.indexed_at,
	};
}

function mapRecord(row: RecordRow): VectorRecord {
	return { ...mapChunk(row), vector: decodeVector(row.vector) };
}

function encodeVector(values: readonly number[]): Uint8Array {
	return new Uint8Array(new Float32Array(values).buffer);
}

function decodeVector(value: Uint8Array): number[] {
	const bytes = Uint8Array.from(value);
	return [...new Float32Array(bytes.buffer)];
}

function normalize(vector: Float32Array): Float32Array {
	let norm = 0;
	for (const value of vector) norm += value * value;
	norm = Math.sqrt(norm);
	if (norm > 0) for (let index = 0; index < vector.length; index += 1) vector[index] /= norm;
	return vector;
}
