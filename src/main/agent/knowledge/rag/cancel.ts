import { ragJob } from './job';

export function cancelRagIndexing(): void {
	ragJob.controller?.abort(new Error('Knowledge indexing was cancelled.'));
}
