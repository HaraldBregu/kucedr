import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { Upload } from '@aws-sdk/lib-storage';
import { S3ObjectStore } from '../../../../src/main/storage/s3/store';

jest.mock('@aws-sdk/lib-storage', () => ({ Upload: jest.fn() }));
jest.mock('../../../../src/main/storage/limits', () => ({ STORAGE_MAX_OBJECT_BYTES: 8 }));

const send = jest.fn();
const done = jest.fn();
const store = new S3ObjectStore({ send }, 'archive');
let directory: string;

beforeEach(async () => {
	jest.resetAllMocks();
	directory = await mkdtemp(join(tmpdir(), 'kucedr-s3-test-'));
	(Upload as unknown as jest.Mock).mockImplementation(() => ({ done }));
});

afterEach(async () => {
	await rm(directory, { recursive: true, force: true });
});

it('uploads files above the in-memory limit through bounded multipart streaming', async () => {
	const file = join(directory, 'source');
	const data = Buffer.alloc(32, 7);
	await writeFile(file, data);
	done.mockImplementation(async () => {
		const { params } = (Upload as unknown as jest.Mock).mock.calls[0][0];
		const chunks: Buffer[] = [];
		for await (const chunk of params.Body) chunks.push(chunk);
		expect(Buffer.concat(chunks)).toEqual(data);
	});
	await store.putFile('kucedr/backup/file', file);
	expect(Upload).toHaveBeenCalledWith(expect.objectContaining({
		queueSize: 2,
		partSize: 8 * 1024 * 1024,
		leavePartsOnError: false,
		params: expect.objectContaining({
			Bucket: 'archive', Key: 'kucedr/backup/file', ContentLength: 32,
		}),
	}));
});

it('closes upload streams and sanitizes failed multipart errors', async () => {
	const file = join(directory, 'source');
	await writeFile(file, 'backup');
	done.mockRejectedValue(Object.assign(new Error('credential leak'), { name: 'AccessDenied' }));
	await expect(store.putFile('file', file)).rejects.toThrow('do not have permission');
	expect((Upload as unknown as jest.Mock).mock.calls[0][0].params.Body.destroyed).toBe(true);
});

it('downloads files above the in-memory limit directly to a temporary file', async () => {
	const data = Buffer.alloc(32, 9);
	send.mockResolvedValue({ ContentLength: 32, Body: Readable.from([data]) });
	const file = join(directory, 'download');
	await store.getFile('file', file);
	expect(await readFile(file)).toEqual(data);
});

it('does not overwrite an existing local file', async () => {
	const file = join(directory, 'existing');
	await writeFile(file, 'keep');
	const body = Readable.from([Buffer.from('replace')]);
	send.mockResolvedValue({ Body: body });
	await expect(store.getFile('file', file)).rejects.toThrow('S3 request failed');
	expect(await readFile(file, 'utf8')).toBe('keep');
	expect(body.destroyed).toBe(true);
});

it('fails interrupted downloads instead of reporting a partial file as complete', async () => {
	const body = Readable.from((async function* () {
		yield Buffer.from('partial');
		throw new Error('provider stream failed');
	})());
	send.mockResolvedValue({ Body: body });
	await expect(store.getFile('file', join(directory, 'download'))).rejects.toThrow('S3 request failed');
	expect(body.destroyed).toBe(true);
});
