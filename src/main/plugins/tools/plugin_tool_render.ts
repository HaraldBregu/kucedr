import { spawn } from 'node:child_process';
import path from 'node:path';
import { pluginTools } from './plugin_tool_list';

const TIMEOUT_MS = 10_000;
const MAX_OUTPUT = 2 * 1024 * 1024;
// ponytail: unbounded in-memory cache, add an LRU if many distinct renders pile up
const cache = new Map<string, Promise<string>>();

/** Runs a plugin tool's script with `{ input, theme }` on stdin and returns the HTML it prints. */
export function renderPluginTool(
	name: string,
	input: unknown,
	theme: 'light' | 'dark'
): Promise<string> {
	const tool = pluginTools().find((candidate) => candidate.name === name);
	if (!tool) return Promise.reject(new Error(`No plugin tool named "${name}".`));
	const key = JSON.stringify([tool.directory, name, input, theme]);
	const cached = cache.get(key);
	if (cached) return cached;

	const result = new Promise<string>((resolve, reject) => {
		const child = spawn(process.execPath, [path.join(tool.directory, ...tool.entry.split('/'))], {
			cwd: tool.directory,
			env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
			timeout: TIMEOUT_MS,
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		let size = 0;
		child.stdout.on('data', (chunk: Buffer) => {
			size += chunk.length;
			if (size > MAX_OUTPUT) child.kill();
			else stdout.push(chunk);
		});
		child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
		child.on('error', reject);
		child.on('close', (code) => {
			if (size > MAX_OUTPUT) return reject(new Error(`${name}: output is larger than 2 MB.`));
			const message = Buffer.concat(stderr).toString('utf8').trim();
			if (code !== 0) return reject(new Error(message || `${name} exited with code ${code}.`));
			resolve(Buffer.concat(stdout).toString('utf8'));
		});
		child.stdin.end(JSON.stringify({ input, theme }));
	});
	cache.set(key, result);
	result.catch(() => cache.delete(key));
	return result;
}
