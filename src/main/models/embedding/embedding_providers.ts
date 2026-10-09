export interface EmbeddingProvider {
	name: string;
	url: string;
	local?: boolean;
}

export const EMBEDDING_PROVIDERS: Record<string, EmbeddingProvider> = {
	bge: { name: 'BGE-M3', url: 'http://localhost:8080/v1/embeddings', local: true },
	cohere: { name: 'Cohere', url: 'https://api.cohere.com/v2/embed' },
	google: { name: 'Google', url: 'https://generativelanguage.googleapis.com/v1beta' },
	jina: { name: 'Jina AI', url: 'https://api.jina.ai/v1/embeddings' },
	nomic: { name: 'Nomic', url: 'https://api-atlas.nomic.ai/v1/embedding/text' },
	openai: { name: 'OpenAI', url: 'https://api.openai.com/v1/embeddings' },
	voyage: { name: 'Voyage AI', url: 'https://api.voyageai.com/v1/embeddings' },
};
