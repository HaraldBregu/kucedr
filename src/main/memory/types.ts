import type { MemoryConfig } from '../../shared/memory_types';

export interface SourceMessage {
	fingerprint: string;
	role: 'user' | 'assistant';
	text: string;
}
export interface SourceSession {
	id: string;
	messages: SourceMessage[];
}
export interface MemoryState {
	config: MemoryConfig;
	initialized: boolean;
	modelInitialized: boolean;
	checkpoints: Record<string, string[]>;
	suppressed: string[];
	lastSuccess: string | null;
	mutation?: { digest: string; checkpoints: Record<string, string[]>; suppressed: string[] };
}
export interface MemoryDependencies {
	store: { load(): MemoryState; save(state: MemoryState): void };
	prepare?(): Promise<void>;
	sources(): Promise<SourceSession[]>;
	exists(): Promise<boolean>;
	read(): Promise<string>;
	write(markdown: string): Promise<void>;
	writeSession(sessionId: string, markdown: string): Promise<void>;
	removeSession(sessionId: string): Promise<void>;
	infer(
		config: MemoryConfig,
		systemPrompt: string,
		request: string,
		signal: AbortSignal
	): Promise<string>;
	selection(): Pick<MemoryConfig, 'providerId' | 'modelId' | 'modelOptions'>;
	schedule(expression: string, timezone: string, callback: () => Promise<void>): { stop(): void };
	validate(config: MemoryConfig): void;
}
export interface StoredEntry {
	id: string;
	fact: string;
	lineIndex: number;
	kind?: 'fact' | 'summary';
	topic?: string;
}
