import path from 'node:path';
import { utilityProcess } from 'electron';
import type { PluginScript } from '../plugins/scripts/plugin_script_list';

/** Runs a VECTOR script in a utility process with one message and returns its result. */
export function forkVectorScript<T>(
	script: PluginScript,
	message: Record<string, unknown>,
	signal?: AbortSignal
): Promise<T> {
	signal?.throwIfAborted();
	const child = utilityProcess.fork(
		path.join(script.directory, ...script.metadata.entry.split('/')),
		[],
		{ cwd: script.directory, serviceName: `${script.title} (${script.plugin.name})` }
	);
	return new Promise<T>((resolve, reject) => {
		const abort = (): void => {
			child.kill();
			reject(signal?.reason);
		};
		signal?.addEventListener('abort', abort, { once: true });
		child.once('message', (reply: { result?: T; error?: string }) => {
			signal?.removeEventListener('abort', abort);
			child.kill();
			if (reply.error !== undefined) reject(new Error(reply.error));
			else resolve(reply.result as T);
		});
		child.once('exit', (code) => {
			signal?.removeEventListener('abort', abort);
			reject(new Error(`${script.title} exited with code ${code}.`));
		});
		child.postMessage(message);
	});
}
