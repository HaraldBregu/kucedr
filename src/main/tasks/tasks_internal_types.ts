export interface TaskJobHandle {
	stop(): void;
	getNextRun(): Date | null;
}
