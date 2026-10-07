import { runBrowserPageOperation as runOperation } from '../browser_abort';
import { browserSession } from './session';

export function runBrowserPageOperation<T>(
	page: { close(): Promise<void> },
	signal: AbortSignal | undefined,
	operation: () => Promise<T>
): Promise<T> {
	const disconnect = browserSession().disconnect;
	return runOperation(disconnect ? { close: disconnect } : page, signal, operation);
}
