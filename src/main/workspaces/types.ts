export interface Workspace {
	readonly id: string;
	readonly root: string;
	readonly files: string;
	readonly sessions: string;
	readonly library: string;
	readonly memory: string;
	readonly rag: string;
	readonly browser: string;
	readonly coder: string;
	readonly settings: string;
	readonly partition: string;
}
