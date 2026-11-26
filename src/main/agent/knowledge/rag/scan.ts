/// <reference types="electron-vite/node" />
import type { Worker } from 'node:worker_threads';
import createWorker from './worker?nodeWorker';
import { ragVectorFile } from './vector_file';
import type { VectorHit } from './types';

interface Waiting {
	resolve(hits: VectorHit[]): void;
	reject(error: unknown): void;
}

const workers = new Map<string, { worker: Worker; waiting: Map<number, Waiting> }>();
let next = 0;

export function scanRag(
	indexName: string,
	vector?: readonly number[],
	topK = 0,
	signal?: AbortSignal
): Promise<VectorHit[]> {
	signal?.throwIfAborted();
	const file = ragVectorFile();
	let current = workers.get(file);
	if (!current) {
		const worker = createWorker({ workerData: file });
		const waiting = new Map<number, Waiting>();
		const fail = (error: unknown): void => {
			if (workers.get(file)?.worker === worker) workers.delete(file);
			for (const entry of waiting.values()) entry.reject(error);
			waiting.clear();
		};
		worker.unref();
		worker.on('message', (reply: { id: number; hits?: VectorHit[]; error?: string }) => {
			const entry = waiting.get(reply.id);
			waiting.delete(reply.id);
			if (reply.hits) entry?.resolve(reply.hits);
			else entry?.reject(new Error(reply.error));
		});
		worker.on('error', fail);
		worker.on('exit', (code) => fail(new Error(`Knowledge search stopped with code ${code}.`)));
		current = { worker, waiting };
		workers.set(file, current);
	}
	const { worker, waiting } = current;
	const id = next++;
	return new Promise<VectorHit[]>((resolve, reject) => {
		const abort = (): void => {
			waiting.delete(id);
			reject(signal?.reason);
		};
		signal?.addEventListener('abort', abort, { once: true });
		waiting.set(id, {
			resolve: (hits) => {
				signal?.removeEventListener('abort', abort);
				resolve(hits);
			},
			reject: (error) => {
				signal?.removeEventListener('abort', abort);
				reject(error);
			},
		});
		worker.postMessage({ id, indexName, vector: vector ? [...vector] : undefined, topK });
	});
}
