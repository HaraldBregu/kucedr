import { uploadRagMirror } from './upload';
import { discardRagMirror } from './discard';
import { ragDatabaseKey } from './database';
import { getRagConfiguration } from './rag_store';
import type { RagMirror } from './types';

export function createRagMirror(): RagMirror {
	const apiKey = ragDatabaseKey(getRagConfiguration());
	return {
		upload: uploadRagMirror.bind(undefined, apiKey),
		discard: discardRagMirror.bind(undefined, apiKey),
	};
}
