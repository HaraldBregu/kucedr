import { spawn } from 'node:child_process';
import path from 'node:path';
import type { PluginScript } from './plugin_script_list';

const TIMEOUT_MS = 10_000;
const MAX_OUTPUT = 2 * 1024 * 1024;

/** Runs a plugin script with `payload` as JSON on stdin and returns what it prints. */
export function spawnPluginScript(script: PluginScript, payload: unknown): Promise<string> {
	const { name } = script;
	return new Promise<string>((resolve, reject) => {
		const child = spawn(
			process.execPath,
			[path.join(script.directory, ...script.metadata.entry.split('/'))],
			{
				cwd: script.directory,
				env: { ...commandEnvironment(), ELECTRON_RUN_AS_NODE: '1' },
				timeout: TIMEOUT_MS,
				killSignal: 'SIGKILL',
			}
		);
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		let size = 0;
		let stderrSize = 0;
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
		child.stdin.on('error', () => undefined);
		child.stdin.end(JSON.stringify(payload));
	});
}
