export interface MemoryConfig {
	enabled: boolean;
	providerId: string;
	modelId: string;
	modelOptions: Record<string, unknown>;
	memoryType: 'facts' | 'summaries' | 'both';
	scheduleEnabled: boolean;
	cronExpression: string;
	timezone: string;
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
export interface MemoryService {
	getConfig(): MemoryConfig;
	configure(patch: Partial<MemoryConfig>): Promise<MemoryConfig>;
	refresh(trigger?: 'manual' | 'startup' | 'wake' | 'cron'): Promise<MemoryStatus>;
	status(): MemoryStatus;
	context(query: string): Promise<string>;
	list(): Promise<MemoryEntry[]>;
	read(): Promise<string>;
	edit(markdown: string, expected?: string): Promise<void>;
	forget(id: string): Promise<{ removed: boolean }>;
	clear(): Promise<void>;
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
	forget(id: string): Promise<{ removed: boolean }>;
	clear(): Promise<void>;
}
