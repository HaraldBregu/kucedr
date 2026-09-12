import path from 'node:path';
import { containsSecret } from './secrets';
import type { SourceSafetyInput } from './types';

const SECRET_FILE = /(^|\/)(\.env(?:\.|$)|credentials\.json$|id_rsa$|[^/]+\.(?:pem|key|p12|pfx)$)/i;
export function assertKnowledgeSourceSafe(source: SourceSafetyInput): void {
	const normalized = source.relativePath.split(path.sep).join('/');
	if (SECRET_FILE.test(normalized))
		throw new Error(`Refusing to ingest credential-like file: ${normalized}`);
	if (containsSecret(source.content) || containsSecret(normalized)) {
		throw new Error('Refusing to ingest source containing credential-like content.');
	}
}
