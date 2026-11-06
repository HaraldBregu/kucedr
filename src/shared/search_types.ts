export type SearchEngineId = string;

export interface SearchEngineInput {
	apiKey: string;
}

export interface SearchSettings {
	engineId: SearchEngineId | null;
	configured: Record<SearchEngineId, boolean>;
}

export interface SearchRequest {
	query: string;
	count?: number;
}

export interface SearchResult {
	title: string;
	url: string;
	description: string;
}

export interface SearchResponse {
	query: string;
	results: SearchResult[];
}
