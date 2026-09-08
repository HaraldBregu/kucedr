import { Readable } from 'node:stream';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { S3ObjectStore } from '../../../../src/main/storage/s3/store';

jest.mock('../../../../src/main/storage/limits', () => ({ STORAGE_MAX_OBJECT_BYTES: 8 }));

const send = jest.fn();
const store = new S3ObjectStore({ send }, 'archive');

beforeEach(() => jest.resetAllMocks());

it('uploads bytes to the selected bucket using the existing backup key', async () => {
	send.mockResolvedValue({});
	const data = new Uint8Array([1, 2, 3]);
	await store.put('kucedr/v1/agent/file.txt', data, 'text/plain');
	expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
	expect(send.mock.calls[0][0].input).toEqual({ Bucket: 'archive', Key: 'kucedr/v1/agent/file.txt', Body: data, ContentType: 'text/plain' });
});

it('downloads a streamed object without changing its bytes', async () => {
	send.mockResolvedValue({ ContentLength: 4, Body: Readable.from([Buffer.from([1, 2]), Buffer.from([3, 4])]) });
	await expect(store.get('kucedr/v1/agent/file.txt')).resolves.toEqual(Buffer.from([1, 2, 3, 4]));
	expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
	expect(send.mock.calls[0][0].input).toEqual({ Bucket: 'archive', Key: 'kucedr/v1/agent/file.txt' });
});

it('lists every page recursively using the requested prefix and continuation token', async () => {
	send.mockResolvedValueOnce({
		Contents: [{ Key: 'kucedr/v1/agent/one', Size: 3, LastModified: new Date('2026-01-01T00:00:00Z') }],
		IsTruncated: true, NextContinuationToken: 'next',
	}).mockResolvedValueOnce({ Contents: [{ Key: 'kucedr/v1/agent/folder/two', Size: 4 }], IsTruncated: false });
	await expect(store.list('kucedr/v1/agent/')).resolves.toEqual([
		{ key: 'kucedr/v1/agent/one', size: 3, lastModified: '2026-01-01T00:00:00.000Z' },
		{ key: 'kucedr/v1/agent/folder/two', size: 4, lastModified: undefined },
	]);
	expect(send.mock.calls[0][0]).toBeInstanceOf(ListObjectsV2Command);
	expect(send.mock.calls[0][0].input).toEqual({ Bucket: 'archive', Prefix: 'kucedr/v1/agent/' });
	expect(send.mock.calls[1][0].input).toEqual({ Bucket: 'archive', Prefix: 'kucedr/v1/agent/', ContinuationToken: 'next' });
});

it('handles an empty bucket', async () => {
	send.mockResolvedValue({});
	await expect(store.list()).resolves.toEqual([]);
});

it.each([undefined, 'repeated'])('rejects broken pagination token %p', async (token) => {
	send.mockResolvedValue({ IsTruncated: true, NextContinuationToken: token });
	await expect(store.list()).rejects.toThrow('invalid listing pagination');
	expect(send.mock.calls.length).toBeLessThanOrEqual(2);
});

it('rejects oversized uploads before sending bytes', async () => {
	await expect(store.put('file', new Uint8Array(9))).rejects.toThrow('50 MiB');
	expect(send).not.toHaveBeenCalled();
});

it('closes oversized downloads before reading the body', async () => {
	const body = Readable.from([Buffer.alloc(9)]);
	send.mockResolvedValue({ ContentLength: 9, Body: body });
	await expect(store.get('file')).rejects.toThrow('50 MiB');
	expect(body.destroyed).toBe(true);
});

it('enforces download limits when the server omits or understates the size', async () => {
	const body = Readable.from([Buffer.alloc(5), Buffer.alloc(5)]);
	send.mockResolvedValue({ ContentLength: 1, Body: body });
	await expect(store.get('file')).rejects.toThrow('50 MiB');
	expect(body.destroyed).toBe(true);
});

it.each(['../outside', '/absolute', 'folder/../outside', 'folder\\outside', 'folder//file'])('rejects unsafe object key %s', async (key) => {
	await expect(store.put(key, new Uint8Array())).rejects.toThrow('object key is invalid');
	await expect(store.get(key)).rejects.toThrow('object key is invalid');
	await expect(store.list(key)).rejects.toThrow('object key is invalid');
	expect(send).not.toHaveBeenCalled();
});

it('exposes useful S3 permission errors without forwarding server-provided credentials or details', async () => {
	const error = new Error('secret-access-key in provider response');
	error.name = 'AccessDenied';
	send.mockRejectedValue(error);
	await expect(store.list()).rejects.toThrow('do not have permission');
	await expect(store.get('file')).rejects.not.toThrow('secret-access-key');
});
