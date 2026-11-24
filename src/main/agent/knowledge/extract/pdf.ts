/// <reference types="electron-vite/node" />
import createWorker from './worker?nodeWorker';
import { KNOWLEDGE_REQUEST_TIMEOUT_MS } from '../limits';
import type { RagSegment } from '../rag/types';

export function pdfText(bytes: Buffer, signal?: AbortSignal): Promise<RagSegment[]> {
	const stop = AbortSignal.any([AbortSignal.timeout(KNOWLEDGE_REQUEST_TIMEOUT_MS), ...(signal ? [signal] : [])]);
	stop.throwIfAborted();
	const worker = createWorker({
		workerData: new Uint8Array(bytes),
		resourceLimits: { maxOldGenerationSizeMb: 1024 },
	});
	return new Promise<RagSegment[]>((resolve, reject) => {
		const abort = (): void => reject(stop.reason);
		stop.addEventListener('abort', abort, { once: true });
		worker.once('message', (reply: { pages?: RagSegment[]; error?: string }) =>
			reply.pages ? resolve(reply.pages) : reject(new Error(reply.error))
		);
		worker.once('error', reject);
		worker.once('exit', (code) => reject(new Error(`PDF reader exited with code ${code}.`)));
	}).finally(() => {
		void worker.terminate();
	});
}
