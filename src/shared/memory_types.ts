export interface MemoryConfig {
	enabled: boolean;
	providerId: string;
	modelId: string;
	modelOptions: Record<string, unknown>;
	memoryType: 'facts' | 'summaries' | 'both';
}
export interface MemoryEntry {
	id: string;
	fact: string;
}
export interface MemoryStatus {
	running: boolean;
	lastSuccess: string | null;
	error: string | null;
	pending: number;
}
export interface MemoryMessage {
	role: string;
	content: unknown;
}
export interface MemoryService {
	getConfig(): MemoryConfig;
	configure(patch: Partial<MemoryConfig>): Promise<MemoryConfig>;
	refresh(trigger?: 'manual' | 'startup' | 'wake'): Promise<MemoryStatus>;
	status(): MemoryStatus;
	context(query: string): Promise<string>;
	list(): Promise<MemoryEntry[]>;
	read(): Promise<string>;
	edit(markdown: string, expected?: string): Promise<void>;
	forget(match: string): Promise<{ removed: number }>;
	clear(): Promise<void>;
	capture(sessionId: string, messages: readonly MemoryMessage[]): Promise<void>;
	remove(sessionId: string): Promise<void>;
	start(): Promise<void>;
	stop(): Promise<void>;
}
export interface MemoryApi {
	getConfig(): Promise<MemoryConfig>;
	configure(patch: Partial<MemoryConfig>): Promise<MemoryConfig>;
	refresh(): Promise<MemoryStatus>;
	status(): Promise<MemoryStatus>;
	list(): Promise<MemoryEntry[]>;
	read(): Promise<string>;
	edit(markdown: string, expected?: string): Promise<void>;
	forget(match: string): Promise<{ removed: number }>;
	clear(): Promise<void>;
}
