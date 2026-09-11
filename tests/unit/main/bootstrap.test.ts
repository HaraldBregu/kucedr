jest.mock('../../../src/main/channels', () => ({ createChannelRegistry: jest.fn() }));
jest.mock('../../../src/main/agent/sandbox', () => ({ ExecSandbox: jest.fn() }));

import { cleanup, type MainServices } from '../../../src/main/bootstrap';

it('settles storage operations before cloud and auth teardown', async () => {
	let finishStorage: (() => void) | undefined;
	const storageOperations = {
		settle: jest.fn(
			() =>
				new Promise<void>((resolve) => {
					finishStorage = resolve;
				})
		),
	};
	const cloudService = { destroy: jest.fn(async () => undefined) };
	const authService = { destroy: jest.fn() };
	const services = {
		logger: { info: jest.fn(), destroy: jest.fn() },
		terminalManager: { shutdown: jest.fn() },
		agentService: { destroy: jest.fn() },
		codingService: { destroy: jest.fn() },
		conversationService: { execute: jest.fn(async () => undefined) },
		windowContextManager: { destroyAll: jest.fn(async () => undefined) },
		storageOperations,
		cloudService,
		authService,
		channelRegistry: { destroy: jest.fn(async () => undefined) },
	} as unknown as MainServices;

	const cleaning = cleanup(services);
	for (let attempt = 0; attempt < 3 && !storageOperations.settle.mock.calls.length; attempt += 1) {
		await Promise.resolve();
	}

	expect(storageOperations.settle).toHaveBeenCalledTimes(1);
	expect(cloudService.destroy).not.toHaveBeenCalled();
	expect(authService.destroy).not.toHaveBeenCalled();
	finishStorage?.();
	await cleaning;

	expect(cloudService.destroy).toHaveBeenCalledTimes(1);
	expect(authService.destroy).toHaveBeenCalledTimes(1);
});
