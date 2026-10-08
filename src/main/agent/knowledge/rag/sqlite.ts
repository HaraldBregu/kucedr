import { restrictSettingsFile } from '../../../shared/restrict_settings_file';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { validateVector } from './validate';
import type {
	IndexRow,
	RecordRow,
	VectorIndex,
	VectorMatch,
	VectorPublication,
	VectorRecord,
	VectorStore,
} from './types';

export class SqliteVectorStore implements VectorStore {
	private readonly database: DatabaseSync;
	private readonly getIndexStatement: StatementSync;
	private readonly reusableSourceStatement: StatementSync;
	private readonly activeRecordsStatement: StatementSync;
	private readonly insertRecordStatement: StatementSync;
	private readonly publishIndexStatement: StatementSync;
	private readonly deleteOldRecordsStatement: StatementSync;

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
			SELECT c.id, c.source_id, c.source_fingerprint, c.path, c.chunk_index,
				c.line_start, c.line_end, c.text,
				c.checksum, c.indexed_at, c.vector
			FROM rag_chunks c
			JOIN rag_indexes i
				ON i.index_name = c.index_name AND i.active_generation = c.generation
			WHERE c.index_name = ? AND c.source_id = ? AND c.source_fingerprint = ?
				AND i.provider_id = ? AND i.model_id = ?
			ORDER BY c.chunk_index
		`);
		this.activeRecordsStatement = this.database.prepare(`
			SELECT c.id, c.source_id, c.source_fingerprint, c.path, c.chunk_index,
				c.line_start, c.line_end, c.text,
				c.checksum, c.indexed_at, c.vector
			FROM rag_chunks c
			JOIN rag_indexes i
				ON i.index_name = c.index_name AND i.active_generation = c.generation
			WHERE c.index_name = ?
		`);
		this.insertRecordStatement = this.database.prepare(`
			INSERT INTO rag_chunks (
				index_name, generation, id, source_id, source_fingerprint, path, chunk_index,
				line_start, line_end, text, checksum, indexed_at, vector
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

	publish(publication: VectorPublication): void {
		if (publication.records.length === 0) throw new Error('Cannot publish an empty vector index.');
		for (const record of publication.records) {
			validateVector(record.vector, publication.dimensions);
		}

		this.database.exec('BEGIN IMMEDIATE');
		try {
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
			this.publishIndexStatement.run(
				publication.indexName,
				publication.generation,
				publication.providerId,
				publication.modelId,
				publication.dimensions,
				publication.completedAt
			);
			this.deleteOldRecordsStatement.run(publication.indexName, publication.generation);
			this.database.exec('COMMIT');
		} catch (error) {
			this.database.exec('ROLLBACK');
			throw error;
		}
	}

	search(indexName: string, vector: readonly number[], topK: number): VectorMatch[] {
		const index = this.getIndex(indexName);
		if (!index) return [];
		if (vector.length !== index.dimensions)
			throw new Error('Query vector dimensions do not match.');
		validateVector(vector, index.dimensions);
		if (!Number.isFinite(topK)) throw new Error('Knowledge result count must be finite.');
		const count = Math.max(1, Math.min(Math.trunc(topK), 100));
		const rows = this.activeRecordsStatement.all(indexName) as unknown as RecordRow[];
		return rows
			.map((row) => {
				const record = mapRecord(row);
				return { ...record, score: cosine(vector, record.vector) };
			})
			.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
			.slice(0, count);
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
			this.database.exec('COMMIT');
			return { records: Number(records), indexRemoved };
		} catch (error) {
			this.database.exec('ROLLBACK');
			throw error;
		}
	}

	close(): void {
		this.database.close();
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

function mapRecord(row: RecordRow): VectorRecord {
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
		vector: decodeVector(row.vector),
	};
}

function encodeVector(values: readonly number[]): Uint8Array {
	return new Uint8Array(new Float32Array(values).buffer);
}

function decodeVector(value: Uint8Array): number[] {
	const bytes = Uint8Array.from(value);
	return [...new Float32Array(bytes.buffer)];
}

function cosine(left: readonly number[], right: readonly number[]): number {
	let dot = 0;
	let leftNorm = 0;
	let rightNorm = 0;
	for (let index = 0; index < left.length; index += 1) {
		dot += left[index] * right[index];
		leftNorm += left[index] * left[index];
		rightNorm += right[index] * right[index];
	}
	return leftNorm === 0 || rightNorm === 0 ? 0 : dot / Math.sqrt(leftNorm * rightNorm);
}
