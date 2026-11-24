import path from 'node:path';
import { ragLocation } from './rag_location';

export function ragVectorFile(): string {
	return path.join(ragLocation(), 'vectors.sqlite');
}
