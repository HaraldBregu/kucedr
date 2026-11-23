import path from 'node:path';
import { containsSecret } from './secrets';
import type { SourceSafetyInput } from './types';

const SECRET_FILE = /(^|\/)(\.env(?:\.|$)|credentials\.json$|id_rsa$|[^/]+\.(?:pem|key|p12|pfx)$)/i;
export function isKnowledgeSourceSecret(source: SourceSafetyInput): boolean {
	const normalized = source.relativePath.split(path.sep).join('/');
	return SECRET_FILE.test(normalized) || containsSecret(source.content) || containsSecret(normalized);
}
