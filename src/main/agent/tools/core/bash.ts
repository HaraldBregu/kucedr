import { superviseProcess } from '../../execution/supervise';
import { executionScope } from '../../execution/scope';
import { commandEnvironment } from '../../execution/environment';
import { terminateProcessTree } from '../../execution/terminate';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { agentLocation } from '../../../shared/agent_location';
import { resolveUserPath } from '../../../shared/user_path';
import { tool } from '../tool';
import { registry } from './process';
import type { ExecSandbox } from '../../sandbox';
import type { ExecutionMode } from '../../../../shared/sandbox';
import { approvedExecRoots } from '../../permissions/approved_exec_roots';
import { resolveExecRoots } from '../../permissions/resolve_exec_roots';
import path from 'node:path';
import { readOnlyShellError } from './readonly';

interface ExecResult {
	command: string;
	workdir: string;
	roots: string[];
	background: boolean;
	pty: boolean;
	executionMode: ExecutionMode;
	pid?: number;
	sessionId?: string;
	exitCode?: number | null;
	signal?: NodeJS.Signals | null;
	stdout: string;
	stderr: string;
	durationMs: number;
	timedOut?: boolean;
	stdoutTruncated?: boolean;
	stderrTruncated?: boolean;
}

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'\\''`)}'`;
}

const execInputSchema = z.object({
	command: z.string().min(1).describe('Shell command to execute'),
	workdir: z
		.string()
		.min(1)
		.optional()
		.describe(
			'Working directory. Relative paths resolve from the workspace; ~ expands to the user home.'
		),
	additionalRoots: z
		.array(z.string().min(1))
		.optional()
		.describe(
			'Directories outside the workspace where the command needs to create, modify, or delete files. Include workdir itself when it needs write access. Relative paths resolve from workdir. Reads do not require additionalRoots.'
		),
	env: z.record(z.string(), z.string()).optional(),
	yieldMs: z
		.number()
		.min(0)
		.max(540_000)
		.optional()
		.describe('Milliseconds to wait before backgrounding (default 10000)'),
	background: z.boolean().optional().describe('Run in background immediately'),
	timeout: z
		.number()
		.positive()
		.optional()
		.describe('Timeout in seconds (optional, kills process on expiry)'),
	pty: z
		.boolean()
		.optional()
		.describe('Run in a pseudo-terminal (PTY) when available (TTY-required CLIs, coding agents)'),
	elevated: z
		.boolean()
		.optional()
		.describe(
			'Run outside the filesystem sandbox after approval. This does not grant administrator or root privileges.'
		),
	host: z
		.enum(['auto', 'sandbox'])
		.optional()
		.describe('Exec host/target (auto|sandbox).'),
});

async function runExec(
	sandbox: ExecSandbox,
	input: z.infer<typeof execInputSchema>,
	abortSignal?: AbortSignal,
	readOnly = false
): Promise<ExecResult> {
	abortSignal?.throwIfAborted();
	const scope = executionScope.getStore();
	if (!scope) throw new Error('Command execution requires an owning session.');
	const {
		command,
		workdir,
		env: envInput,
		yieldMs: yieldMsInput,
		background: backgroundInput,
		timeout: timeoutInput,
		pty: ptyInput,
		elevated: elevatedInput,
		host: hostInput,
	} = input;
	if (readOnly) {
		const policyError = readOnlyShellError(input, agentLocation());
		if (policyError) throw new Error(policyError);
	}

	if (elevatedInput === true && hostInput === 'sandbox') {
		throw new Error("exec host 'sandbox' cannot be combined with elevated mode.");
	}

	const env = commandEnvironment(envInput);

	const roots = resolveExecRoots(input, agentLocation());
	const cwd = roots[0] ?? resolveUserPath(workdir ?? '.', agentLocation());
	if (readOnly) {
		const relative = path.relative(agentLocation(), cwd);
		if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
			throw new Error('Read-only commands must run inside the workspace.');
	}
	const readOnlyTimeoutSeconds = Math.min(timeoutInput ?? 60, 120);
	const yieldMs = yieldMsInput ?? 10000;
	const timeoutMs = readOnly
		? readOnlyTimeoutSeconds * 1000
		: timeoutInput === undefined
			? undefined
			: timeoutInput * 1000;
	const startedAt = Date.now();
	const pty = ptyInput === true && process.platform !== 'win32';
	const executionMode: ExecutionMode = elevatedInput === true ? 'host' : 'sandbox';
	const hostCommand = pty ? 'script' : command;
	const ptyArgs =
		process.platform === 'darwin' ||
		process.platform === 'freebsd' ||
		process.platform === 'openbsd' ||
		process.platform === 'netbsd'
			? ['-q', '/dev/null', process.env.SHELL ?? '/bin/sh', '-lc', command]
			: ['-q', '-e', '-c', command, '/dev/null'];
	const hostArgs = pty ? ptyArgs : [];
	const ptyCommand = ['script', ...ptyArgs].map(shellQuote).join(' ');
	const commandId = randomUUID();
	const approvedRoots = approvedExecRoots.getStore() ?? [];
	const wrapped =
		executionMode === 'sandbox'
			? await sandbox.wrap(
					pty ? ptyCommand : command,
					cwd,
					commandId,
					abortSignal,
					approvedRoots,
					readOnly
				)
			: undefined;
	const spawnCommand = wrapped?.command ?? hostCommand;
	const spawnArgs = wrapped?.args ?? hostArgs;
	const shell = wrapped ? false : !pty;
	Object.assign(env, wrapped?.env, envInput);
	let sandboxCleaned = false;
	const cleanupSandbox = (): void => {
		if (executionMode !== 'sandbox' || sandboxCleaned) return;
		sandboxCleaned = true;
		sandbox.cleanup(commandId);
	};

	if (backgroundInput === true) {
		const child = spawn(spawnCommand, spawnArgs, {
			cwd,
			env,
			shell,
			detached: process.platform !== 'win32',
			stdio: 'ignore',
		});
		superviseProcess(child, abortSignal);
		if (executionMode === 'sandbox') sandbox.track(child);
		registry.track(scope, child);
		let timeoutTimer: NodeJS.Timeout | undefined;
		if (timeoutMs !== undefined) {
			timeoutTimer = setTimeout(() => terminateProcessTree(child), timeoutMs);
			timeoutTimer.unref();
		}
		return await new Promise<ExecResult>((resolve, reject) => {
			let settled = false;
			const cleanup = (): void => {
				if (timeoutTimer) clearTimeout(timeoutTimer);
				abortSignal?.removeEventListener('abort', abort);
			};
			const abort = (): void => {
				terminateProcessTree(child);
				if (settled) return;
				settled = true;
				cleanup();
				reject(abortSignal?.reason ?? new Error('Exec cancelled.'));
			};
			abortSignal?.addEventListener('abort', abort, { once: true });
			if (abortSignal?.aborted) abort();
			child.once('error', (error) => {
				if (settled) return;
				settled = true;
				cleanup();
				cleanupSandbox();
				reject(error);
			});
			child.once('exit', () => {
				cleanupSandbox();
				cleanup();
			});
			child.once('spawn', () => {
				if (settled || abortSignal?.aborted) return;
				settled = true;
				child.unref();
				resolve({
					command,
					workdir: cwd,
					roots,
					background: true,
					pty,
					executionMode,
					pid: child.pid,
					stdout: '',
					stderr: '',
					durationMs: Date.now() - startedAt,
				});
			});
		});
	}

	const child = spawn(spawnCommand, spawnArgs, {
		cwd,
		env,
		shell,
		detached: process.platform !== 'win32',
		stdio: [readOnly ? 'ignore' : 'pipe', 'pipe', 'pipe'],
	});

	superviseProcess(child, abortSignal);
	if (executionMode === 'sandbox') sandbox.track(child);
	registry.track(scope, child);
	child.stdin?.on('error', () => undefined);
	child.stdout.setEncoding('utf8');
	child.stderr.setEncoding('utf8');
	const maxOutputLength = 90000;
	let stdout = '';
	let stderr = '';
	let stdoutTruncated = false;
	let stderrTruncated = false;
	let timedOut = false;

	child.stdout.on('data', (chunk: string) => {
		const next = stdout + chunk;
		stdout = next.slice(-maxOutputLength);
		stdoutTruncated = stdoutTruncated || next.length > maxOutputLength;
	});
	child.stderr.on('data', (chunk: string) => {
		const next = stderr + chunk;
		stderr = next.slice(-maxOutputLength);
		stderrTruncated = stderrTruncated || next.length > maxOutputLength;
	});

	return await new Promise<ExecResult>((resolve, reject) => {
		let settled = false;
		let aborted = false;
		let ownedSession: ProcessSession | undefined;
		let timeoutTimer: NodeJS.Timeout | undefined;
		const yieldTimer = readOnly ? undefined : setTimeout(() => {
			if (settled || aborted) return;
			settled = true;

			const sessionId = randomUUID();
			ownedSessionId = sessionId;
			const session = registry.register({
				id: sessionId,
				scope,
				pid: child.pid,
				command,
				workdir: cwd,
				roots: roots.slice(1),
				startedAt,
				executionMode,
				stdout,
				stderr,
				exitCode: undefined,
				exitSignal: undefined,
				exited: false,
				child,
			});

			child.stdout.removeAllListeners('data');
			child.stderr.removeAllListeners('data');
			child.stdout.on('data', (chunk: Buffer | string) =>
				registry.append(session, 'stdout', chunk.toString())
			);
			child.stderr.on('data', (chunk: Buffer | string) =>
				registry.append(session, 'stderr', chunk.toString())
			);
			child.once('close', (exitCode, signal) => {
				if (executionMode === 'sandbox') {
					session.stderr = sandbox.annotate(commandId, session.stderr);
				}
				cleanupSandbox();
				session.exited = true;
				session.exitCode = exitCode;
				session.exitSignal = signal;
			});

			resolve({
				command,
				workdir: cwd,
				roots,
				background: true,
				sessionId,
				pty,
				executionMode,
				pid: child.pid,
				stdout,
				stderr,
				durationMs: Date.now() - startedAt,
				stdoutTruncated: stdoutTruncated || undefined,
				stderrTruncated: stderrTruncated || undefined,
			});
		}, yieldMs);
		const abort = (): void => {
			aborted = true;
			terminateProcessTree(child);
			if (ownedSessionId) registry.remove(ownedSessionId);
		};
		abortSignal?.addEventListener('abort', abort, { once: true });
		if (abortSignal?.aborted) abort();

		if (timeoutMs !== undefined) {
			timeoutTimer = setTimeout(() => {
				timedOut = true;
				terminateProcessTree(child);
			}, timeoutMs);
		}

		child.on('error', (error) => {
			if (settled) return;
			settled = true;
			if (yieldTimer) clearTimeout(yieldTimer);
			if (timeoutTimer) clearTimeout(timeoutTimer);
			abortSignal?.removeEventListener('abort', abort);
			cleanupSandbox();
			reject(error);
		});
		child.on('close', (exitCode, signal) => {
			if (timeoutTimer) clearTimeout(timeoutTimer);
			abortSignal?.removeEventListener('abort', abort);
			if (settled) return;
			settled = true;
			if (yieldTimer) clearTimeout(yieldTimer);
			if (aborted) {
				cleanupSandbox();
				reject(abortSignal?.reason ?? new Error('Exec cancelled.'));
				return;
			}
			if (executionMode === 'sandbox') {
				stderr = sandbox.annotate(commandId, stderr);
			}
			cleanupSandbox();
			resolve({
				command,
				workdir: cwd,
				roots,
				background: false,
				pty,
				executionMode,
				pid: child.pid,
				exitCode,
				signal,
				stdout,
				stderr,
				durationMs: Date.now() - startedAt,
				timedOut: timedOut || undefined,
				stdoutTruncated: stdoutTruncated || undefined,
				stderrTruncated: stderrTruncated || undefined,
			});
		});
	});
}

export function execTool(
	sandbox: ExecSandbox,
	readOnly = false
) {
	const configured = tool({
		id: 'bash',
		category: 'core',
		name: 'Execute command',
		description:
			'Run a shell command in a filesystem sandbox to search (grep, find), list, move or delete files, build, test, or run programs. Do not use it to read or change file contents: use read, edit, write, or patch instead of cat, sed, awk, or scripts. Chain related commands in one call instead of many small calls. ' +
			'Writes are confined to the workspace and trusted locations. Declare outside directories that need write access in additionalRoots to request and optionally remember permission. ' +
			'Runtime cache access may require approval for its containing cache directory. For an intentional host operation, retry with elevated: true to request approval. Set background or yieldMs for long-running commands, timeout to stop slow commands, and pty for TTY-only CLIs.',
		readOnly,
		inputSchema: execInputSchema,
		execute: async (input, signal) => {
			// The model already knows the command, workdir and roots it sent; echoing them doubles tokens per call.
			const { command, workdir, roots, pty, executionMode, ...result } = await runExec(sandbox, input, signal, readOnly);
			if (!result.background) {
				const { background, pid, ...foreground } = result;
				return foreground;
			}
			return result;
		},
	});
	return {
		...configured,
		parseInput(raw: unknown): Record<string, unknown> {
			const input = configured.parseInput(raw);
			if (input.elevated === true && input.env && typeof input.env === 'object' && Object.keys(input.env).length > 0)
				throw new Error('Elevated commands cannot override the environment.');
			if (readOnly || input.elevated === true) return input;
			const roots = resolveExecRoots(input, agentLocation());
			const requested = ((input.additionalRoots as string[] | undefined) ?? []).map((root) => resolveUserPath(root, roots[0] ?? agentLocation()));
			const required = sandbox.requiredRoots(requested);
			return required.length > 0
				? { ...input, additionalRoots: [...((input.additionalRoots as string[] | undefined) ?? []), ...required] }
				: input;
		},
	};
}
