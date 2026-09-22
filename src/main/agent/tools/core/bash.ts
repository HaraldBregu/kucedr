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
import type { AgentInteractionMode } from '../../../../shared/agent_types';
import path from 'node:path';
import { planCommandError } from '../../plan/command';

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
		.enum(['auto', 'sandbox', 'gateway', 'node'])
		.optional()
		.describe('Exec host/target (auto|sandbox|gateway|node).'),
	security: z
		.string()
		.optional()
		.describe(
			'Ignored for normal calls; exec security is set by tools.exec.security and host approvals.'
		),
	node: z.string().optional().describe('Node id/name for host=node.'),
});

async function runExec(
	sandbox: ExecSandbox,
	input: z.infer<typeof execInputSchema>,
	abortSignal?: AbortSignal,
	interactionMode: AgentInteractionMode = 'default'
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
	const planMode = interactionMode === 'plan';
	if (planMode) {
		const policyError = planCommandError(input, agentLocation());
		if (policyError) throw new Error(policyError);
	}

	if (hostInput === 'gateway' || hostInput === 'node') {
		throw new Error(`exec host '${hostInput}' is not available in this runtime.`);
	}
	if (elevatedInput === true && hostInput === 'sandbox') {
		throw new Error("exec host 'sandbox' cannot be combined with elevated mode.");
	}

	const env = commandEnvironment(envInput);

	const roots = resolveExecRoots(input, agentLocation());
	const cwd = roots[0] ?? resolveUserPath(workdir ?? '.', agentLocation());
	if (planMode) {
		const relative = path.relative(agentLocation(), cwd);
		if (relative.startsWith('..') || path.isAbsolute(relative))
			throw new Error('Plan commands must run inside the workspace.');
	}
	const planTimeoutSeconds = Math.min(timeoutInput ?? 60, 120);
	const yieldMs = yieldMsInput ?? 10000;
	const timeoutMs = planMode
		? planTimeoutSeconds * 1000
		: timeoutInput === undefined
			? undefined
			: timeoutInput * 1000;
	const startedAt = Date.now();
	const pty = ptyInput === true;
	const executionMode: ExecutionMode = elevatedInput === true ? 'host' : 'sandbox';
	const hostCommand = pty ? 'script' : command;
	const hostArgs = pty
		? process.platform === 'darwin' ||
			process.platform === 'freebsd' ||
			process.platform === 'openbsd' ||
			process.platform === 'netbsd'
			? ['-q', '/dev/null', process.env.SHELL ?? '/bin/sh', '-lc', command]
			: ['-q', '-e', '-c', command, '/dev/null']
		: [];
	const ptyCommand =
		process.platform === 'darwin' ||
		process.platform === 'freebsd' ||
		process.platform === 'openbsd' ||
		process.platform === 'netbsd'
			? `script -q /dev/null ${shellQuote(process.env.SHELL ?? '/bin/sh')} -lc ${shellQuote(command)}`
			: `script -q -e -c ${shellQuote(command)} /dev/null`;
	const commandId = randomUUID();
	const approvedRoots = approvedExecRoots.getStore() ?? [];
	const wrapped =
		executionMode === 'sandbox'
			? interactionMode === 'plan'
				? await sandbox.wrap(
						pty ? ptyCommand : command,
						cwd,
						commandId,
						abortSignal,
						approvedRoots,
						'plan'
					)
				: await sandbox.wrap(
						pty ? ptyCommand : command,
						cwd,
						commandId,
						abortSignal,
						approvedRoots
					)
			: undefined;
	const spawnCommand = wrapped?.command ?? hostCommand;
	const spawnArgs = wrapped?.args ?? hostArgs;
	const shell = wrapped ? false : !pty;
	Object.assign(env, wrapped?.env);
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
	});

	superviseProcess(child, abortSignal);
	if (executionMode === 'sandbox') sandbox.track(child);
	const maxOutputLength = 200000;
	let stdout = '';
	let stderr = '';
	let stdoutTruncated = false;
	let stderrTruncated = false;
	let timedOut = false;

	child.stdout.on('data', (chunk: Buffer | string) => {
		if (stdout.length >= maxOutputLength) {
			stdoutTruncated = true;
			return;
		}
		const next = stdout + chunk.toString();
		stdout = next.slice(0, maxOutputLength);
		stdoutTruncated = stdoutTruncated || next.length > maxOutputLength;
	});
	child.stderr.on('data', (chunk: Buffer | string) => {
		if (stderr.length >= maxOutputLength) {
			stderrTruncated = true;
			return;
		}
		const next = stderr + chunk.toString();
		stderr = next.slice(0, maxOutputLength);
		stderrTruncated = stderrTruncated || next.length > maxOutputLength;
	});

	return await new Promise<ExecResult>((resolve, reject) => {
		let settled = false;
		let aborted = false;
		let ownedSessionId: string | undefined;
		let timeoutTimer: NodeJS.Timeout | undefined;
		const yieldTimer = planMode ? undefined : setTimeout(() => {
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
	interactionMode: AgentInteractionMode = 'default'
) {
	const configured = tool({
		id: 'bash',
		name: 'Execute command',
		description:
			'Run a shell command in a filesystem sandbox. Reads are allowed; writes are confined to the workspace and trusted locations. Declare outside directories that need write access in additionalRoots to request and optionally remember permission. ' +
			'Runtime cache access may require approval for its containing cache directory. For an intentional host operation, retry with elevated: true to request approval. Set background or yieldMs for long-running commands, timeout to stop slow commands, and pty for TTY-only CLIs.',
		planSafe: interactionMode === 'plan',
		inputSchema: execInputSchema,
		execute: (input, signal) => runExec(sandbox, input, signal, interactionMode),
	});
	return {
		...configured,
		parseInput(raw: unknown): Record<string, unknown> {
			const input = configured.parseInput(raw);
			if (interactionMode === 'plan' || input.elevated === true) return input;
			const roots = resolveExecRoots(input, agentLocation());
			const requested = ((input.additionalRoots as string[] | undefined) ?? []).map((root) => resolveUserPath(root, roots[0] ?? agentLocation()));
			const required = sandbox.requiredRoots(requested);
			return required.length > 0
				? { ...input, additionalRoots: [...((input.additionalRoots as string[] | undefined) ?? []), ...required] }
				: input;
		},
	};
}
