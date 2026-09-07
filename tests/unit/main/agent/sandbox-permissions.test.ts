import path from 'node:path';

const initialize = jest.fn().mockResolvedValue(undefined);
const wrapWithSandboxArgv = jest.fn().mockResolvedValue({ argv: ['/bin/sh', '-lc', 'pwd'], env: {} });
const writeFile = jest.fn().mockResolvedValue(undefined);

jest.mock('node:fs/promises', () => ({
	mkdir: jest.fn().mockResolvedValue(undefined),
	writeFile,
	unlink: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@anthropic-ai/sandbox-runtime', () => ({
	SandboxManager: {
		initialize,
		wrapWithSandboxArgv,
		isSupportedPlatform: () => true,
		isSandboxingEnabled: () => false,
		reset: jest.fn(),
		cleanupAfterCommand: jest.fn(),
		annotateStderrWithSandboxFailures: (_id: string, stderr: string) => stderr,
	},
	VENDORED_SRT_WIN_EXE: '/vendor/srt-win.exe',
	getDefaultWritePaths: () => ['/dev/null', '/tmp/claude', '/home/user/.npm/_logs'],
	installWindowsSandboxAsync: jest.fn(),
	resolveSrtWin: jest.fn(),
}));
jest.mock('../../../../src/main/agent/agent_store', () => ({
	getPermissions: () => ({
		read: { allow: ['/workspace/**'], deny: ['/workspace/private/**'] },
		write: { allow: ['/workspace/**'], deny: ['/workspace/private/**'] },
		exec: { allow: ['/workspace/**', '/shared/**'], deny: ['/shared/private/**'] },
	}),
}));

import { ExecSandbox } from '../../../../src/main/agent/sandbox';
import { agentLocation } from '../../../../src/main/shared/agent_location';
import { realPath } from '../../../../src/main/shared/real_path';
import { execTool } from '../../../../src/main/agent/tools/core/bash';

describe('ExecSandbox permissions', () => {
	it('allows the Linux sandbox helper under both execution profiles', async () => {
		const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
		Object.defineProperty(process, 'platform', { ...platform, value: 'linux' });
		try {
			const sandbox = new ExecSandbox();
			await sandbox.wrap('pwd', '/workspace', 'linux-command');
			const config = initialize.mock.calls.at(-1)?.[0];
			expect(config.filesystem.denyRead).not.toContain(config.seccomp.applyPath);
			await sandbox.wrap('pwd', agentLocation(), 'linux-plan', undefined, [], 'plan');
			const plan = JSON.parse(writeFile.mock.calls.at(-1)?.[1] as string);
			expect(plan.filesystem.allowRead).toContain(plan.seccomp.applyPath);
		} finally {
			Object.defineProperty(process, 'platform', platform);
		}
	});

	it('includes the cache ancestor in canonical command input before approval, preserving the working directory', () => {
		const configured = execTool(new ExecSandbox());
		const input = configured.parseInput({ command: 'pwd', workdir: '/tmp/claude/project', additionalRoots: ['.'] });
		expect(input).toEqual({ command: 'pwd', workdir: '/tmp/claude/project', additionalRoots: ['.', realPath('/tmp/claude')] });
		expect(configured.parseInput(input)).toEqual(input);
		expect(configured.parseInput({ command: 'pwd', additionalRoots: ['/tmp/claude/project'] })).toMatchObject({ additionalRoots: ['/tmp/claude/project', realPath('/tmp/claude')] });
	});

	it('does not expand cache scope without a write request, or for elevated or Plan commands', () => {
		const sandbox = new ExecSandbox();
		expect(execTool(sandbox).parseInput({ command: 'pwd', workdir: '/tmp/claude/project' })).toEqual({ command: 'pwd', workdir: '/tmp/claude/project' });
		expect(execTool(sandbox).parseInput({ command: 'pwd', workdir: '/workspace' })).toEqual({ command: 'pwd', workdir: '/workspace' });
		const input = { command: 'pwd', workdir: '/tmp/claude/project', elevated: true };
		expect(execTool(sandbox).parseInput(input)).toEqual(input);
		expect(execTool(sandbox, 'plan').parseInput({ command: 'pwd', workdir: '/tmp/claude/project' })).toEqual({ command: 'pwd', workdir: '/tmp/claude/project' });
	});

	it('applies typed read and write denies to command execution', async () => {
		const configuration = await (
			new ExecSandbox() as unknown as {
				configuration: () => Promise<{ config: { filesystem: Record<string, string[]> } }>;
			}
		).configuration();

		expect(configuration.config.filesystem.allowRead).toEqual([]);
		expect(configuration.config.filesystem.allowWrite).toEqual(
			expect.arrayContaining(['/workspace/**', '/shared/**'])
		);
		expect(configuration.config.filesystem.denyRead).toEqual(
			expect.arrayContaining(['/shared/private/**'])
		);
		expect(configuration.config.filesystem.denyRead).toContain('/workspace/private/**');
		expect(configuration.config.filesystem.denyWrite).toEqual(['/shared/private/**', '/workspace/private/**', '/tmp/claude', '/home/user/.npm/_logs']);
		expect(configuration.config.filesystem.denyRead).not.toContain(path.parse(agentLocation()).root);
	});

	it('removes a runtime cache write restriction only for its approved invocation', async () => {
		const sandbox = new ExecSandbox();
		await sandbox.wrap('pwd', '/workspace', 'approved-cache', undefined, ['/tmp/claude']);
		const approved = wrapWithSandboxArgv.mock.calls.at(-1)?.[2];
		expect(approved.filesystem.denyWrite).not.toContain('/tmp/claude');
		expect(approved.filesystem.allowWrite).toContain('/tmp/claude/**');
		await sandbox.wrap('pwd', '/workspace', 'unapproved-cache');
		expect(wrapWithSandboxArgv.mock.calls.at(-1)?.[2].filesystem.denyWrite).toContain('/tmp/claude');
	});

	it('adds an approved outside root only to the wrapped invocation', async () => {
		await new ExecSandbox().wrap('pwd', '/workspace', 'command', undefined, ['/outside']);
		expect(wrapWithSandboxArgv).toHaveBeenCalledWith(
			'pwd',
			'/bin/sh',
			expect.objectContaining({
				filesystem: expect.objectContaining({
					allowRead: expect.arrayContaining(['/outside/**']),
					allowWrite: expect.arrayContaining(['/outside/**']),
				}),
			}),
			undefined,
			'/workspace',
			{ commandId: 'command', commandText: 'pwd' }
		);
	});

	it('uses per-command filesystem rules on Unix', async () => {
		await new ExecSandbox().wrap('pwd', '/workspace', 'command');
		expect(wrapWithSandboxArgv).toHaveBeenCalledWith(
			'pwd',
			'/bin/sh',
			expect.objectContaining({ filesystem: expect.any(Object) }),
			undefined,
			'/workspace',
			{ commandId: 'command', commandText: 'pwd' }
		);
	});

	it('uses a networkless read-only workspace profile for Plan commands', async () => {
		const wrapped = await new ExecSandbox().wrap(
			'git status',
			agentLocation(),
			'plan-command',
			undefined,
			[],
			'plan'
		);
		const config = JSON.parse(writeFile.mock.calls.at(-1)?.[1] as string);
		expect(config.network).toMatchObject({
			allowedDomains: [],
			deniedDomains: ['*'],
			allowLocalBinding: false,
		});
		expect(config.filesystem).toMatchObject({
			denyRead: ['/', '/shared/private/**', '/workspace/private/**'],
			allowRead: expect.arrayContaining([agentLocation()]),
			allowWrite: expect.any(Array),
			denyWrite: expect.arrayContaining([
				agentLocation(),
				'/tmp/claude',
				'/home/user/.npm/_logs',
			]),
		});
		expect(wrapped.args).toEqual(
			expect.arrayContaining(['--settings', expect.stringContaining('plan-command.json'), '-c', 'git status'])
		);
		expect(wrapWithSandboxArgv).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({ network: expect.anything() }),
			expect.anything(),
			expect.anything(),
			expect.anything()
		);
	});
});
