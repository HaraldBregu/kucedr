import type { TaskJobHandle } from './tasks_internal_types';
import type { TaskRunner } from './tasks_types';

export const tasks = new Map<string, TaskJobHandle>();
export let enabled = true;
export let runner: TaskRunner | undefined;

export function setTaskEnabled(value: boolean): void {
	enabled = value;
}

export function setTaskRunner(value: TaskRunner | undefined): void {
	runner = value;
}
