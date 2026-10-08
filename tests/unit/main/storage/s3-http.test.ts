import { createServer } from 'node:http';
import { createHash, createHmac } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transferStorage } from '../../../../src/main/storage/s3/transfer';

it('round trips signed path-style requests, multipart files, listings and sanitized errors', async () => {
	const objects = new Map<string, Buffer>();
	const parts = new Map<number, Buffer>();
	const requests: string[] = [];
	const failures: string[] = [];
	const server = createServer(async (request, response) => {
		try {
			const chunks: Buffer[] = [];
			for await (const chunk of request) chunks.push(Buffer.from(chunk));
			const body = Buffer.concat(chunks);
			const url = new URL(request.url!, 'http://localhost');
			const authorization = request.headers.authorization ?? '';
			const credential = /Credential=([^,]+)/.exec(authorization)?.[1] ?? '';
			const signed = /SignedHeaders=([^,]+)/.exec(authorization)?.[1] ?? '';
			const signature = /Signature=([a-f0-9]+)/.exec(authorization)?.[1];
			expect(authorization).toMatch(/^AWS4-HMAC-SHA256 /);
			expect(credential).toMatch(/^test-access\/\d{8}\/us-east-1\/s3\/aws4_request$/);
			const headers = signed.split(';').map((name) =>
				`${name}:${String(request.headers[name]).trim().replace(/\s+/g, ' ')}\n`
			).join('');
			const query = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))
				.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
			const payloadHash = String(request.headers['x-amz-content-sha256']);
			if (payloadHash !== 'UNSIGNED-PAYLOAD') {
				expect(payloadHash).toBe(createHash('sha256').update(body).digest('hex'));
			}
			const canonical = [request.method, url.pathname, query, headers, signed, payloadHash].join('\n');
			const scope = credential.substring(credential.indexOf('/') + 1);
			const stringToSign = ['AWS4-HMAC-SHA256', request.headers['x-amz-date'], scope,
				createHash('sha256').update(canonical).digest('hex')].join('\n');
			let signingKey: Buffer = Buffer.from('AWS4test-secret');
			for (const segment of scope.split('/')) signingKey = createHmac('sha256', signingKey).update(segment).digest();
			expect(signature).toBe(createHmac('sha256', signingKey).update(stringToSign).digest('hex'));
			expect(url.pathname).toMatch(/^\/archive(?:\/|$)/);
			requests.push(`${request.method} ${url.search}`);
			response.setHeader('Content-Type', 'application/xml');
			if (url.searchParams.has('uploads')) {
				response.end('<InitiateMultipartUploadResult><UploadId>test-upload</UploadId></InitiateMultipartUploadResult>');
			} else if (request.method === 'PUT' && url.searchParams.has('partNumber')) {
				parts.set(Number(url.searchParams.get('partNumber')), body);
				response.setHeader('ETag', '"part"');
				response.end();
			} else if (request.method === 'POST' && url.searchParams.has('uploadId')) {
				objects.set(url.pathname, Buffer.concat([...parts].sort(([a], [b]) => a - b).map(([, data]) => data)));
				response.end('<CompleteMultipartUploadResult><ETag>"complete"</ETag></CompleteMultipartUploadResult>');
			} else if (url.searchParams.has('list-type')) {
				response.end('<ListBucketResult><IsTruncated>false</IsTruncated>' + [...objects].map(([key, data]) =>
					`<Contents><Key>${key.substring('/archive/'.length)}</Key><Size>${data.length}</Size></Contents>`
				).join('') + '</ListBucketResult>');
			} else if (request.method === 'PUT') {
				objects.set(url.pathname, body);
				response.setHeader('ETag', '"object"');
				response.end();
			} else if (objects.has(url.pathname)) {
				response.end(objects.get(url.pathname));
			} else {
				response.statusCode = 404;
				response.end('<Error><Code>NoSuchKey</Code><Message>test-secret hidden</Message></Error>');
			}
		} catch (error) {
			failures.push(String(error));
			response.statusCode = 500;
			response.end('<Error><Code>InternalError</Code></Error>');
		}
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const directory = await mkdtemp(join(tmpdir(), 'kucedr-s3-http-'));
	try {
		const address = server.address() as { port: number };
		await transferStorage({
			id: 'a00c674a-c8c8-4d01-930f-ad690b3d0123', name: 'Local',
			endpoint: `http://127.0.0.1:${address.port}`, region: 'us-east-1', bucket: 'archive',
			accessKeyId: 'test-access', secretAccessKey: 'test-secret', forcePathStyle: true,
		}, async (store) => {
			const data = Buffer.alloc(9 * 1024 * 1024, 5);
			const source = join(directory, 'source');
			const destination = join(directory, 'download');
			await writeFile(source, data);
			await store.putFile!('backup/file', source);
			await store.getFile!('backup/file', destination);
			expect(await readFile(destination)).toEqual(data);
			await store.put('backup/manifest', Buffer.from('manifest'));
			expect(await store.get('backup/manifest')).toEqual(Buffer.from('manifest'));
			expect(await store.list('backup/')).toEqual(expect.arrayContaining([
				expect.objectContaining({ key: 'backup/file', size: data.length }),
				expect.objectContaining({ key: 'backup/manifest', size: 8 }),
			]));
			await expect(store.get('missing')).rejects.toThrow('backup file was not found');
		});
		expect(failures).toEqual([]);
		expect(requests.filter((request) => request.includes('partNumber='))).toHaveLength(2);
	} finally {
		await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
		await rm(directory, { recursive: true, force: true });
	}
}, 20_000);
