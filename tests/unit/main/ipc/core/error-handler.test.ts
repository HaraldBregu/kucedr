import type { IpcMainInvokeEvent } from 'electron';
import {
	wrapIpcHandler,
	wrapSimpleHandler,
} from '../../../../../src/main/ipc/core/error_handler';

const event = {} as IpcMainInvokeEvent;

beforeEach(() => {
	jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('wrapIpcHandler', () => {
	it('wraps a successful result', async () => {
		const handler = wrapIpcHandler(async (_e, n: number) => n * 2, 'double');
		await expect(handler(event, 21)).resolves.toEqual({ success: true, data: 42 });
	});

	it('captures thrown errors into a failure result', async () => {
		const handler = wrapIpcHandler(async () => {
			throw new Error('kaboom');
		}, 'boom');
		const result = await handler(event);
		expect(result).toMatchObject({
			success: false,
			error: { code: 'Error', message: 'kaboom' },
		});
		expect(console.error).toHaveBeenCalled();
	});

	it('coerces non-Error throwables via the handler name fallback', async () => {
		const handler = wrapIpcHandler(async () => {
			throw undefined;
		}, 'namedHandler');
		const result = await handler(event);
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error.message).toBe('namedHandler failed.');
	});

	it('omits stack outside development', async () => {
		const prev = process.env.NODE_ENV;
		process.env.NODE_ENV = 'production';
		const handler = wrapIpcHandler(async () => {
			throw new Error('x');
		}, 'h');
		const result = await handler(event);
		process.env.NODE_ENV = prev;
		if (!result.success) expect(result.error.stack).toBeUndefined();
	});
});

describe('wrapSimpleHandler', () => {
	it('passes args through without the event', async () => {
		const handler = wrapSimpleHandler((a: number, b: number) => a + b, 'add');
		await expect(handler(event, 2, 3)).resolves.toEqual({ success: true, data: 5 });
	});
});
