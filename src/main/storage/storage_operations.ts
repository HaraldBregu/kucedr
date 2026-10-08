import { randomUUID } from 'node:crypto';
import type {
	StorageOperation,
	StorageOperationStatus,
	StorageOperationTrigger,
	StoragePullResult,
	StoragePushResult,
	StorageRestoreInput,
} from '../../shared/storage_types';
import { describeStorageError } from './storage_error';

type StorageTransferResult = StoragePushResult | StoragePullResult;

export interface StorageOperationDependencies {
	backup: () => Promise<StoragePushResult>;
	restore: (input?: StorageRestoreInput) => Promise<StoragePullResult>;
	lock: <T>(operation: () => Promise<T>) => Promise<T>;
	preventSuspension: () => () => void;
}

export class StorageOperations {
	private status?: StorageOperationStatus;
	private readonly tasks = new Map<string, Promise<StorageOperationStatus>>();
	private revision = 0;

	constructor(
		private readonly onStatusChanged: (status: StorageOperationStatus) => void,
		private readonly dependencies: StorageOperationDependencies
	) {}

	getStatus(): StorageOperationStatus | undefined {
		return this.status;
	}

	isRunning(): boolean {
		return this.status?.state === 'running';
	}

	backup(trigger: StorageOperationTrigger): StorageOperationStatus {
		return this.start('backup', trigger);
	}

	restore(input?: StorageRestoreInput): StorageOperationStatus {
		return this.start('restore', 'manual', input);
	}

	wait(operationId: string): Promise<StorageOperationStatus | undefined> {
		return this.tasks.get(operationId) ?? Promise.resolve(undefined);
	}

	async settle(): Promise<void> {
		await Promise.allSettled([...this.tasks.values()]);
	}

	private start(
		operation: StorageOperation,
		trigger: StorageOperationTrigger,
		input?: StorageRestoreInput
	): StorageOperationStatus {
		const current = this.status;
		if (current?.state === 'running') {
			if (current.operation === operation) return current;
			throw new Error('A cloud operation is already running for this storage.');
		}

		const status: StorageOperationStatus = {
			operationId: randomUUID(),
			operation,
			trigger,
			state: 'running',
			startedAt: new Date().toISOString(),
			transferred: 0,
			skipped: 0,
			failed: 0,
			revision: ++this.revision,
		};
		this.publish(status);
		const task = this.execute(status, input);
		this.tasks.set(status.operationId, task);
		void task.then(
			() => {
				this.tasks.delete(status.operationId);
			},
			() => {
				this.tasks.delete(status.operationId);
			}
		);
		return status;
	}

	private async execute(running: StorageOperationStatus, input?: StorageRestoreInput): Promise<StorageOperationStatus> {
		let allowSuspension: (() => void) | undefined;
		try {
			allowSuspension = this.dependencies.preventSuspension();
			const result: StorageTransferResult =
				running.operation === 'backup'
					? await this.dependencies.lock(this.dependencies.backup)
					: await this.dependencies.lock(() => this.dependencies.restore(input));
			const transferred = 'uploaded' in result ? result.uploaded.length : result.downloaded.length;
			return this.finish(running, result, transferred);
		} catch (error) {
			return this.publish({
				...running,
				state: 'failed',
				finishedAt: new Date().toISOString(),
				error: describeStorageError(error),
				revision: ++this.revision,
			});
		} finally {
			try {
				allowSuspension?.();
			} catch (error) {
				void error;
			}
		}
	}

	private finish(
		running: StorageOperationStatus,
		result: StorageTransferResult,
		transferred: number
	): StorageOperationStatus {
		return this.publish({
			...running,
			state: result.failed.length > 0 ? (transferred || ('skipped' in result && result.skipped.length) ? 'partial' : 'failed') : 'succeeded',
			finishedAt: new Date().toISOString(),
			transferred,
			skipped: 'skipped' in result ? result.skipped.length : 0,
			failed: result.failed.length,
			...(result.failed.length ? { error: result.failed[0].error } : {}),
			revision: ++this.revision,
		});
	}

	private publish(status: StorageOperationStatus): StorageOperationStatus {
		this.status = status;
		try {
			this.onStatusChanged(status);
		} catch (error) {
			void error;
		}
		return status;
	}
}
