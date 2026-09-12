import { getRagConfiguration } from '../../knowledge/rag';
import type { Tool } from '../../types';
import { queryKnowledgeTool } from './query_knowledge';

export function getKnowledgeTools(): Tool[] {
	if (getRagConfiguration().enabled !== true) return [];
	return [queryKnowledgeTool];
}
