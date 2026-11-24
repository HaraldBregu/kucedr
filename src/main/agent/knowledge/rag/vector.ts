import { SqliteVectorStore } from './sqlite';
import { ragVectorFile } from './vector_file';
import type { VectorStore } from './types';

export function ragVectorStore(): VectorStore {
	return new SqliteVectorStore(ragVectorFile());
}
