import { executionScope, type ExecutionScope } from '../../execution/scope';
import { terminateProcessTree } from '../../execution/terminate';
import type { ChildProcess } from 'node:child_process';
import { z } from 'zod';
import { tool } from '../tool';
import type { Tool } from '../../types';
import type { ExecutionMode } from '../../../../shared/sandbox';

const MAX_BUFFER = 500_000;

export interface ProcessSession {
	readonly scope: ExecutionScope;
	readonly id: string;
	readonly pid: number | undefined;
	readonly command: string;
	readonly workdir: string;
	readonly roots: readonly string[];
	readonly startedAt: number;
	readonly executionMode: ExecutionMode;
	stdout: string;
	stderr: string;
	exitCode: number | null | undefined;
	exitSignal: string | null | undefined;
	exited: boolean;
	timedOut?: boolean;
	readonly child: ChildProcess;
}

class SessionRegistry {
	private readonly sessions = new Map<string, ProcessSession>();

	register(session: ProcessSession): ProcessSession {
		this.sessions.set(session.id, session);
		return session;
	}

	get(id: string): ProcessSession | undefined {
		return this.sessions.get(id);
	}

	list(): ProcessSession[] {
		const scope = executionScope.getStore();
		if (!scope) throw new Error('Process access requires an owning session.');
		return [...this.sessions.values()].filter((session) => session.scope.ownerId === scope.ownerId &&
			session.scope.source === scope.source && session.scope.sessionId === scope.sessionId);
	}

	owned(id: string): ProcessSession | undefined {
		return this.list().find((session) => session.id === id);
	}

	remove(id: string): boolean {
		return this.sessions.delete(id);
	}

	append(session: ProcessSession, stream: 'stdout' | 'stderr', chunk: string): void {
		if (stream === 'stdout') {
			session.stdout = (session.stdout + chunk).slice(-MAX_BUFFER);
		} else {
			session.stderr = (session.stderr + chunk).slice(-MAX_BUFFER);
		}
	}
}

export const registry = new SessionRegistry();

const SPECIAL_KEYS: Record<string, string> = {
	Enter: '\r',
	Return: '\r',
	Tab: '\t',
	Escape: '\x1b',
	Backspace: '\x7f',
	'Ctrl+C': '\x03',
	'Ctrl+D': '\x04',
	'Ctrl+Z': '\x1a',
	'Ctrl+L': '\x0c',
	Up: '\x1b[A',
	Down: '\x1b[B',
	Right: '\x1b[C',
	Left: '\x1b[D',
};

function sessionSummary(s: ProcessSession) {
	return {
		sessionId: s.id,
		pid: s.pid,
		command: s.command,
		workdir: s.workdir,
		startedAt: s.startedAt,
		executionMode: s.executionMode,
		exited: s.exited,
		exitCode: s.exitCode,
		exitSignal: s.exitSignal,
		timedOut: s.timedOut,
		stdoutLength: s.stdout.length,
		stderrLength: s.stderr.length,
	};
}

function paginateLines(
	text: string,
	offset: number,
	lines: number
): { content: string; nextOffset: number; hasMore: boolean } {
	const all = text.split('\n');
	const slice = all.slice(offset, offset + lines);
	return {
		content: slice.join('\n'),
		nextOffset: offset + slice.length,
		hasMore: offset + slice.length < all.length,
	};
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	signal?.throwIfAborted();
	return new Promise((resolve, reject) => {
		let settled = false;
		const finish = (): void => {
			if (settled) return;
			settled = true;
			signal?.removeEventListener('abort', abort);
			resolve();
		};
		const timer = setTimeout(finish, ms);
		const abort = (): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			signal?.removeEventListener('abort', abort);
			reject(signal?.reason ?? new Error('Process wait cancelled.'));
		};
		signal?.addEventListener('abort', abort, { once: true });
		if (signal?.aborted) abort();
	});
}

async function pollUntil(
	session: ProcessSession,
	timeoutMs: number,
	signal?: AbortSignal
): Promise<void> {
	const before = session.stdout.length + session.stderr.length;
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		signal?.throwIfAborted();
		if (session.exited) return;
		if (session.stdout.length + session.stderr.length !== before) return;
		await sleep(50, signal);
	}
}

const processInputSchema = z.object({
	action: z
		.enum([
			'list',
			'poll',
			'log',
			'write',
			'send-keys',
			'submit',
			'paste',
			'kill',
			'clear',
			'remove',
		])
		.describe('list|poll|log|write|send-keys|submit|paste|kill|clear|remove'),
	sessionId: z.string().optional().describe('Target session (required for all except list).'),
	timeout: z
		.number()
		.optional()
		.describe('poll: wait up to N ms for new output or exit (max 30000).'),
	offset: z
		.number()
		.optional()
		.describe('log: start from this line number (0-based, for pagination).'),
	lines: z.number().optional().describe('log: number of lines to return (default 200).'),
	text: z.string().optional().describe('write/paste: text to send to stdin.'),
	bytes: z
		.string()
		.optional()
		.describe('send-keys: named key or escape sequence (e.g. "Ctrl+C", "Enter", "\\x03").'),
	literal: z.string().optional().describe('send-keys: literal string to write verbatim to stdin.'),
	signal: z.string().optional().describe('kill: signal name (default SIGTERM).'),
});

async function runProcess(
	input: z.infer<typeof processInputSchema>,
	signal?: AbortSignal
): Promise<unknown> {
	signal?.throwIfAborted();
	const { action } = input;

	if (action === 'list') {
		return registry.list().map(sessionSummary);
	}

	const sessionId = input.sessionId;
	if (!sessionId) throw new Error('process: sessionId is required.');
	const session = registry.owned(sessionId);
	if (!session) throw new Error(`process: session '${sessionId}' not found.`);

	switch (action) {
		case 'poll': {
			const timeoutMs = Math.min(input.timeout ?? 5000, 30000);
			await pollUntil(session, timeoutMs, signal);
			return {
				...sessionSummary(session),
				stdout: session.stdout,
				stderr: session.stderr,
			};
		}

		case 'log': {
			const offset = Math.max(0, input.offset ?? 0);
			const lines = Math.max(1, input.lines ?? 200);
			const stdoutPage = paginateLines(session.stdout, offset, lines);
			const stderrPage = paginateLines(session.stderr, offset, lines);
			return {
				...sessionSummary(session),
				stdout: stdoutPage,
				stderr: stderrPage,
			};
		}

		case 'write': {
			const text = input.text;
			if (text === undefined) throw new Error('process write: text is required.');
			if (!session.child.stdin) throw new Error('process write: session stdin is not available.');
			session.child.stdin.write(text);
			return { sessionId, written: text.length };
		}

		case 'send-keys': {
			if (!session.child.stdin)
				throw new Error('process send-keys: session stdin is not available.');
			const bytes = input.bytes;
			const literal = input.literal;
			if (bytes !== undefined) {
				const resolved =
					SPECIAL_KEYS[bytes] ??
					bytes.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
				session.child.stdin.write(resolved);
				return { sessionId, sent: bytes };
			}
			if (literal !== undefined) {
				session.child.stdin.write(literal);
				return { sessionId, sent: literal };
			}
			throw new Error('process send-keys: bytes or literal is required.');
		}

		case 'submit': {
			if (!session.child.stdin) throw new Error('process submit: session stdin is not available.');
			session.child.stdin.write('\n');
			return { sessionId, submitted: true };
		}

		case 'paste': {
			const text = input.text;
			if (text === undefined) throw new Error('process paste: text is required.');
			if (!session.child.stdin) throw new Error('process paste: session stdin is not available.');
			session.child.stdin.write(text);
			return { sessionId, pasted: text.length };
		}

		case 'kill': {
			const sig = (input.signal ?? 'SIGTERM') as NodeJS.Signals;
			terminateProcessTree(session.child, sig);
			return { sessionId, killed: true, signal: sig };
		}

		case 'clear': {
			session.stdout = '';
			session.stderr = '';
			return { sessionId, cleared: true };
		}

		case 'remove': {
			if (!session.exited) terminateProcessTree(session.child);
			registry.remove(sessionId);
			return { sessionId, removed: true };
		}

		default:
			throw new Error(`process: unknown action '${action}'.`);
	}
}

export const processTool: Tool = tool({
	id: 'process',
	name: 'Manage process',
	description:
		'Manage running exec sessions for commands already started: list, poll, log, write, send-keys, submit, paste, kill. ' +
		'Use poll/log when you need status, logs, quiet-success confirmation, or completion confirmation. ' +
		'Use write/send-keys/submit/paste/kill for input or intervention.',
	inputSchema: processInputSchema,
	execute: runProcess,
});
