const httpsRequest = jest.fn();
const publicUrl = jest.fn();

jest.mock('node:https', () => ({ request: httpsRequest }));
jest.mock('../../../src/main/public', () => ({ publicUrl }));

import { Readable } from 'node:stream';
import { publicRequest } from '../../../src/main/request';

it('connects to the validated address while preserving the public TLS identity', async () => {
	publicUrl.mockResolvedValue({
		url: new URL('https://example.com/page?q=1'),
		address: '93.184.216.34',
		family: 4,
	});
	httpsRequest.mockImplementation((options, callback) => {
		const response = Readable.from([Buffer.from('ok')]) as Readable & {
			headers: Record<string, string>;
			statusCode: number;
			statusMessage: string;
		};
		response.headers = { 'content-type': 'text/plain' };
		response.statusCode = 200;
		response.statusMessage = 'OK';
		callback(response);
		return { once: jest.fn(), end: jest.fn() };
	});

	const { response } = await publicRequest('https://example.com/page?q=1');

	expect(httpsRequest).toHaveBeenCalledWith(
		expect.objectContaining({
			hostname: '93.184.216.34',
			family: 4,
			path: '/page?q=1',
			servername: 'example.com',
			headers: { Host: 'example.com' },
		}),
		expect.any(Function)
	);
	await expect(response.text()).resolves.toBe('ok');
});

it('rejects invalid response statuses without throwing from the response callback', async () => {
	publicUrl.mockResolvedValue({
		url: new URL('https://example.com'),
		address: '93.184.216.34',
		family: 4,
	});
	httpsRequest.mockImplementation((_options, callback) => {
		const response = Object.assign(Readable.from([]), {
			headers: {},
			statusCode: 600,
			statusMessage: 'Invalid',
		});
		queueMicrotask(() => callback(response));
		return { once: jest.fn(), end: jest.fn() };
	});
	await expect(publicRequest('https://example.com')).rejects.toThrow('status');
});

it.each([204, 205, 304])('accepts a response without a body for status %s', async (statusCode) => {
	publicUrl.mockResolvedValue({
		url: new URL('https://example.com'),
		address: '93.184.216.34',
		family: 4,
	});
	httpsRequest.mockImplementation((_options, callback) => {
		const response = Object.assign(Readable.from([]), {
			headers: {},
			statusCode,
			statusMessage: '',
		});
		queueMicrotask(() => callback(response));
		return { once: jest.fn(), end: jest.fn() };
	});
	const { response } = await publicRequest('https://example.com');
	expect(response.status).toBe(statusCode);
	expect(response.body).toBeNull();
});
