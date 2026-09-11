import { app } from 'electron';
import { setupProcessSafetyNet } from '../../../../src/main/shared/error_reporter';

describe('process safety net', () => {
	const originalExitCode = process.exitCode;

	afterEach(() => {
		jest.restoreAllMocks();
		process.exitCode = originalExitCode;
	});

	it('requests a nonzero graceful shutdown after an uncaught exception', () => {
		const listeners = new Map<string, (...args: never[]) => void>();
		jest.spyOn(console, 'error').mockImplementation();
		jest.spyOn(process, 'on').mockImplementation(((event: string, listener: never) => {
			listeners.set(event, listener as (...args: never[]) => void);
			return process;
		}) as typeof process.on);
		const logger = { error: jest.fn(), warn: jest.fn() };
		setupProcessSafetyNet(logger as never);

		listeners.get('uncaughtException')?.(new Error('fatal') as never, 'uncaughtException' as never);

		expect(logger.error).toHaveBeenCalledWith(
			'Process',
			'uncaughtException (uncaughtException)',
			expect.objectContaining({ error: expect.stringContaining('fatal') })
		);
		expect(process.exitCode).toBe(1);
		expect(app.quit).toHaveBeenCalledTimes(1);

		listeners.get('exit')?.(0 as never);
		expect(logger.warn).not.toHaveBeenCalled();

		listeners.get('exit')?.(1 as never);
		expect(logger.warn).toHaveBeenCalledWith(
			'Process',
			'process.exit(1)',
			expect.objectContaining({ stack: expect.any(String) })
		);

		listeners.get('SIGTERM')?.();
		expect(app.exit).toHaveBeenCalledWith(1);
	});
});
