import type {
	StorageOperationDependencies,
	StorageOperations,
} from '../../../../src/main/storage/storage_operations';

const loadOperations = async (): Promise<typeof StorageOperations> =>
	(await import('../../../../src/main/storage/storage_operations')).StorageOperations;

describe('storage operations', () => {
	it('returns running state immediately and retains it until deferred work finishes', async () => {
		let finishBackup: ((value: { uploaded: string[]; failed: [] }) => void) | undefined;
		const backup = jest.fn(
			() =>
				new Promise<{ uploaded: string[]; failed: [] }>((resolve) => {
					finishBackup = resolve;
				})
		);
		const releaseSuspension = jest.fn();
		const onStatusChanged = jest.fn();
		const dependencies: StorageOperationDependencies = {
			backup,
			restore: jest.fn(),
			lock: (operation) => operation(),
			preventSuspension: () => releaseSuspension,
		};
		const Operations = await loadOperations();
		const operations = new Operations(onStatusChanged, dependencies);

		const running = operations.backup('manual');

		expect(running.state).toBe('running');
		expect(operations.getStatus()).toEqual(running);
		expect(onStatusChanged).toHaveBeenCalledWith(running);
		const completion = operations.wait(running.operationId);
		finishBackup?.({ uploaded: ['one', 'two'], failed: [] });
		const finished = await completion;

		expect(finished).toEqual(
			expect.objectContaining({
				state: 'succeeded',
				transferred: 2,
				failed: 0,
			})
		);
		expect(finished?.revision).toBeGreaterThan(running.revision);
		expect(operations.getStatus()).toEqual(finished);
		expect(releaseSuspension).toHaveBeenCalledTimes(1);
	});

	it('publishes partial and fatal terminal states', async () => {
		const onStatusChanged = jest.fn();
		const dependencies: StorageOperationDependencies = {
			backup: jest
				.fn()
				.mockResolvedValueOnce({ uploaded: ['one'], failed: [{ path: 'two', error: 'no' }] })
				.mockRejectedValueOnce(new Error('offline')),
			restore: jest.fn(),
			lock: (operation) => operation(),
			preventSuspension: () => jest.fn(),
		};
		const Operations = await loadOperations();
		const operations = new Operations(onStatusChanged, dependencies);

		const partial = operations.backup('scheduled');
		expect(await operations.wait(partial.operationId)).toEqual(
			expect.objectContaining({ state: 'partial', transferred: 1, failed: 1 })
		);
		const failed = operations.backup('manual');
		expect(await operations.wait(failed.operationId)).toEqual(
			expect.objectContaining({ state: 'failed', error: 'offline' })
		);
	});

	it('reuses a matching active operation and rejects a conflicting restore', async () => {
		const dependencies: StorageOperationDependencies = {
			backup: jest.fn(() => new Promise(() => undefined)),
			restore: jest.fn(),
			lock: (operation) => operation(),
			preventSuspension: () => jest.fn(),
		};
		const Operations = await loadOperations();
		const operations = new Operations(jest.fn(), dependencies);
		const running = operations.backup('manual');

		expect(operations.backup('manual')).toEqual(running);
		expect(() => operations.restore()).toThrow('already running');
	});

	it('publishes a failed terminal state when suspension prevention throws', async () => {
		const backup = jest.fn();
		const dependencies: StorageOperationDependencies = {
			backup,
			restore: jest.fn(),
			lock: (operation) => operation(),
			preventSuspension: () => {
				throw new Error('power blocker unavailable');
			},
		};
		const Operations = await loadOperations();
		const operations = new Operations(jest.fn(), dependencies);

		const running = operations.backup('manual');
		await expect(operations.wait(running.operationId)).resolves.toEqual(
			expect.objectContaining({ state: 'failed', error: 'power blocker unavailable' })
		);
		expect(operations.isRunning()).toBe(false);
		expect(backup).not.toHaveBeenCalled();
	});

	it('does not reject a completed operation when suspension cleanup throws', async () => {
		const dependencies: StorageOperationDependencies = {
			backup: jest.fn().mockResolvedValue({ uploaded: ['one'], failed: [] }),
			restore: jest.fn(),
			lock: (operation) => operation(),
			preventSuspension: () => () => {
				throw new Error('power blocker cleanup failed');
			},
		};
		const Operations = await loadOperations();
		const operations = new Operations(jest.fn(), dependencies);

		const running = operations.backup('manual');
		await expect(operations.wait(running.operationId)).resolves.toEqual(
			expect.objectContaining({ state: 'succeeded', transferred: 1 })
		);
	});

	it('settles only after in-flight storage work finishes', async () => {
		let finishBackup: ((value: { uploaded: string[]; failed: [] }) => void) | undefined;
		const dependencies: StorageOperationDependencies = {
			backup: jest.fn(
				() =>
					new Promise<{ uploaded: string[]; failed: [] }>((resolve) => {
						finishBackup = resolve;
					})
			),
			restore: jest.fn(),
			lock: (operation) => operation(),
			preventSuspension: () => jest.fn(),
		};
		const Operations = await loadOperations();
		const operations = new Operations(jest.fn(), dependencies);
		operations.backup('manual');
		const settled = jest.fn();
		const settling = operations.settle().then(settled);

		await Promise.resolve();
		expect(settled).not.toHaveBeenCalled();
		finishBackup?.({ uploaded: ['one'], failed: [] });
		await settling;

		expect(settled).toHaveBeenCalledTimes(1);
	});

	it('reports failure when no files could be backed up', async () => {
		const dependencies: StorageOperationDependencies = {
			backup: jest.fn().mockResolvedValue({ uploaded: [], failed: [{ path: 'notes.md', error: 'Disconnected' }] }),
			restore: jest.fn(),
			lock: (operation) => operation(),
			preventSuspension: () => jest.fn(),
		};
		const Operations = await loadOperations();
		const operations = new Operations(jest.fn(), dependencies);
		const running = operations.backup('manual');
		expect(await operations.wait(running.operationId)).toEqual(expect.objectContaining({ state: 'failed', transferred: 0, failed: 1, error: 'Disconnected' }));
	});

		it('contains observer failures and still completes the operation', async () => {
		const dependencies: StorageOperationDependencies = {
			backup: jest.fn().mockResolvedValue({ uploaded: ['one'], failed: [] }),
			restore: jest.fn(),
			lock: (operation) => operation(),
			preventSuspension: () => jest.fn(),
		};
		const Operations = await loadOperations();
		const observer = jest.fn(() => {
			throw new Error('renderer unavailable');
		});
		const operations = new Operations(observer, dependencies);

		const running = operations.backup('manual');
		await expect(operations.wait(running.operationId)).resolves.toEqual(
			expect.objectContaining({ state: 'succeeded', transferred: 1 })
		);

		expect(observer).toHaveBeenCalledTimes(2);
		expect(operations.getStatus()).toEqual(expect.objectContaining({ state: 'succeeded' }));
	});
});
