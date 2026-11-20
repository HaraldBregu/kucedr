import type { WebContents } from 'electron';

const NAVIGATION_TIMEOUT_MS = 15_000;

export function settle(contents: WebContents, start: () => void, signal?: AbortSignal): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const done = (error?: unknown): void => {
			clearTimeout(timer);
			contents.off('dom-ready', ready);
			contents.off('did-navigate-in-page', ready);
			contents.off('did-fail-load', failed);
			signal?.removeEventListener('abort', aborted);
			if (error) reject(error);
			else resolve();
		};
		const ready = (): void => done();
		const failed = (
			_event: unknown,
			code: number,
			description: string,
			url: string,
			isMainFrame: boolean
		): void => {
			if (isMainFrame && code !== -3) done(new Error(`Could not load ${url}: ${description || code}`));
		};
		const aborted = (): void => {
			contents.stop();
			done(signal?.reason ?? new Error('Aborted'));
		};
		const timer = setTimeout(() => done(new Error('Navigation timed out.')), NAVIGATION_TIMEOUT_MS);
		contents.on('dom-ready', ready);
		contents.on('did-navigate-in-page', ready);
		contents.on('did-fail-load', failed);
		signal?.addEventListener('abort', aborted, { once: true });
		start();
	});
}
