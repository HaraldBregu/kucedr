import { processTreeAlive } from './execution/alive';
import { terminateProcessTree } from './execution/terminate';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
	SandboxManager,
	VENDORED_SRT_WIN_EXE,
	getDefaultWritePaths,
	installWindowsSandboxAsync,
	resolveSrtWin,
	type SandboxRuntimeConfig,
} from '@anthropic-ai/sandbox-runtime';
import type { ChildProcess } from 'node:child_process';
import type { SandboxStatus } from '../../shared/sandbox';
import { getPermissions } from './agent_store';
import { userDataLocation } from '../shared/user_data_location';
import { ruleMatches } from './permissions/rule_matches';
import type { PermissionRule } from './permissions/permissions_types';
import { currentWorkspace } from '../workspaces/current';
import { sandboxSystemReads } from './sandbox/reads';
import { egress } from './sandbox/egress';
import { realPath } from '../shared/real_path';
import { isPathWithin } from './permissions/permissions_path';
import { protectedRoots } from './permissions/protected';

const WINDOWS_SANDBOX_GUIDANCE =
	'Open Settings > Permissions and complete Windows sandbox setup; administrator or IT approval may be required. Chat and non-command tools remain available.';
const LINUX_SANDBOX_GUIDANCE =
	'Ask IT to provide bubblewrap, socat, and ripgrep and permit unprivileged user namespaces. Chat and non-command tools remain available.';
const OTHER_SANDBOX_GUIDANCE =
	'Ask your administrator to enable command sandboxing for this machine. Chat and non-command tools remain available.';

export interface SandboxedCommand {
	command: string;
	args: string[];
	env: NodeJS.ProcessEnv;
	commandId: string;
}

export class ExecSandbox {
	private fingerprint: string | undefined;
	private transition: Promise<void> = Promise.resolve();
	private readonly children = new Set<ChildProcess>();
	private readonly temporaryDirectory = path.join(userDataLocation(), 'sandbox');
	private readonly readOnlySettings = new Map<string, string>();

	requiredRoots(roots: readonly string[]): string[] {
		const resolved = roots.map(realPath);
		return [...new Set(getDefaultWritePaths().filter((value) => !value.startsWith('/dev/')).map(realPath))].filter((root) =>
			resolved.some((target) => isPathWithin(root, target)) &&
			!resolved.some((target) => isPathWithin(target, root))
		);
	}

	async wrap(
		command: string,
		cwd: string,
		commandId: string,
		signal?: AbortSignal,
		approvedRoots: readonly string[] = [],
		readOnly = false
	): Promise<SandboxedCommand> {
		if (readOnly) return this.wrapReadOnly(command, commandId);
		await this.ensureReady();
		if (process.platform === 'win32' && approvedRoots.length > 0) {
			throw new Error(
				'One-time access to an outside location is unavailable on Windows. Trust the location to continue.'
			);
		}
		const { config } = await this.configuration(approvedRoots);
		const customConfig = process.platform !== 'win32' || approvedRoots.length > 0
			? {
					filesystem: {
						...config.filesystem,
						allowWrite: [...(config.filesystem.allowWrite ?? []), ...approvedRoots],
					},
			}
			: undefined;
		const wrapped = await SandboxManager.wrapWithSandboxArgv(
			command,
			process.platform === 'win32' ? undefined : '/bin/sh',
			customConfig,
			signal,
			cwd,
			{ commandId, commandText: command }
		);
		return {
			command: wrapped.argv[0],
			args: wrapped.argv.slice(1),
			env: {
				...Object.fromEntries(Object.entries(wrapped.env).filter(([key, value]) => process.env[key] !== value)),
				TMPDIR: this.temporaryDirectory,
				TMP: this.temporaryDirectory,
				TEMP: this.temporaryDirectory,
			},
			commandId,
		};
	}

	track(child: ChildProcess): void {
		for (const previous of this.children) {
			if (!processTreeAlive(previous)) this.children.delete(previous);
		}
		this.children.add(child);
		child.once('close', () => {
			if (!processTreeAlive(child)) this.children.delete(child);
		});
	}

	annotate(commandId: string, stderr: string): string {
		if (refused.size > 0) {
			const hosts = [...refused];
			refused.clear();
			stderr = `${stderr}\nNetwork access to ${hosts.join(', ')} was refused: commands may only reach the sites allowed in Settings > Privacy. Retry with allowHosts listing the sites the command needs to ask the user.`;
		}
		const annotated = SandboxManager.annotateStderrWithSandboxFailures(commandId, stderr);
		if (annotated !== stderr) {
			return `${annotated}\nA sandbox restriction blocked this operation. Declare the outside directory in additionalRoots to request access. A command that listens on a port or connects to a local service needs elevated.`;
		}
		if (/operation not permitted|permission denied|\bEPERM\b/i.test(stderr)) {
			return `${stderr}\nThe sandbox may have blocked this operation. Declare the outside directory in additionalRoots to request access. A command that listens on a port or connects to a local service needs elevated.`;
		}
		return stderr;
	}

	cleanup(commandId?: string): void {
		if (commandId) {
			const settings = this.readOnlySettings.get(commandId);
			if (settings) {
				this.readOnlySettings.delete(commandId);
				void fs.unlink(settings).catch(() => undefined);
				return;
			}
		}
		SandboxManager.cleanupAfterCommand();
	}

	async status(): Promise<SandboxStatus> {
		const guidance =
			process.platform === 'win32'
				? WINDOWS_SANDBOX_GUIDANCE
				: process.platform === 'linux'
					? LINUX_SANDBOX_GUIDANCE
					: OTHER_SANDBOX_GUIDANCE;
		if (!SandboxManager.isSupportedPlatform()) {
			return {
				state: 'unavailable',
				platform: process.platform,
				message: `Command sandboxing is unavailable on ${process.platform}. ${guidance}`,
			};
		}
		try {
			const dependencies =
				process.platform === 'win32'
					? await import('@anthropic-ai/sandbox-runtime').then(
							({ checkWindowsDependenciesAsync }) =>
								checkWindowsDependenciesAsync({
									srtWin: resolveSrtWin({ path: this.vendoredWindowsPath() }),
								})
						)
					: await SandboxManager.checkDependenciesAsync();
			if (dependencies.errors.length > 0) {
				return {
					state: process.platform === 'win32' ? 'setup_required' : 'unavailable',
					platform: process.platform,
					message: `${[...dependencies.errors, ...dependencies.warnings].join('\n')}\n${guidance}`,
				};
			}
			return { state: 'ready', platform: process.platform };
		} catch (error) {
			return {
				state: process.platform === 'win32' ? 'setup_required' : 'unavailable',
				platform: process.platform,
				message: `${error instanceof Error ? error.message : String(error)}\n${guidance}`,
			};
		}
	}

	async setup(): Promise<SandboxStatus> {
		if (process.platform !== 'win32') return this.status();
		const srtWin = resolveSrtWin({ path: this.vendoredWindowsPath() });
		const result = await installWindowsSandboxAsync({ srtWin });
		if (result.cancelled) {
			return {
				state: 'setup_required',
				platform: process.platform,
				message: 'Windows sandbox setup was cancelled.',
			};
		}
		await this.invalidate();
		return this.status();
	}

	async invalidate(): Promise<void> {
		await this.stopChildren();
		this.fingerprint = undefined;
		await SandboxManager.reset();
	}

	async reset(): Promise<void> {
		await this.invalidate();
	}

	private async ensureReady(): Promise<void> {
		const { config, fingerprint } = await this.configuration();
		if (this.fingerprint === fingerprint && SandboxManager.isSandboxingEnabled()) return;
		const previous = this.transition;
		let release: (() => void) | undefined;
		this.transition = new Promise<void>((resolve) => {
			release = resolve;
		});
		await previous;
		try {
			if (this.fingerprint === fingerprint && SandboxManager.isSandboxingEnabled()) return;
			if (!SandboxManager.isSupportedPlatform()) {
				throw new Error(`Command sandboxing is unavailable on ${process.platform}.`);
			}
			await fs.mkdir(this.temporaryDirectory, { recursive: true });
			if (SandboxManager.isSandboxingEnabled()) {
				await this.stopChildren();
				await SandboxManager.reset();
			}
			try {
				await SandboxManager.initialize(config, egress);
			} catch (cause) {
				const guidance =
					process.platform === 'win32'
						? WINDOWS_SANDBOX_GUIDANCE
						: process.platform === 'linux'
							? LINUX_SANDBOX_GUIDANCE
							: OTHER_SANDBOX_GUIDANCE;
				const detail = cause instanceof Error ? cause.message : String(cause);
				throw new Error(`Command sandbox is unavailable. ${guidance}\n${detail}`, { cause });
			}
			this.fingerprint = fingerprint;
		} finally {
			release?.();
		}
	}

	private async configuration(approvedRoots: readonly string[] = []): Promise<{
		config: SandboxRuntimeConfig;
		fingerprint: string;
	}> {
		const permissions = getPermissions();
		const roots = (rules: PermissionRule[]): string[] => rules.map((rule) => rule.root);
		const explicitReadDenies = roots([...permissions.exec.deny, ...permissions.read.deny]);
		const explicitWriteDenies = roots([...permissions.exec.deny, ...permissions.write.deny]);
		const allowWrite = [
			...roots(permissions.exec.allow),
			this.temporaryDirectory,
		];
		const writable: PermissionRule[] = [
			...permissions.exec.allow,
			{ root: this.temporaryDirectory, recursive: false },
			...approvedRoots.map((root) => ({ root, recursive: true })),
		];
		const guarded = protectedRoots();
		const denyWrite = [
			...explicitWriteDenies,
			...getDefaultWritePaths().filter((value) =>
				!value.startsWith('/dev/') &&
				!writable.some((rule) => ruleMatches(rule, value))
			),
			...(await this.protectedWrites(guarded.write, [...guarded.writable, realPath(this.temporaryDirectory)])),
		];
		const denyRead = [...explicitReadDenies, ...guarded.read];
		const allowRead: string[] = [];
		const windowsPath = this.vendoredWindowsPath();
		const seccompPath = this.vendoredSeccompPath();
		const config: SandboxRuntimeConfig = {
			network: {
				allowedDomains: [],
				deniedDomains: [],
				allowLocalBinding: false,
				allowUnixSockets: [],
				allowAllUnixSockets: false,
			},
			filesystem: {
				denyRead,
				allowRead,
				allowWrite,
				denyWrite,
			},
			enableWeakerNestedSandbox: false,
			enableWeakerNetworkIsolation: false,
			allowAppleEvents: false,
			allowPty: true,
			...(process.platform === 'win32' ? { windows: { srtWin: { path: windowsPath } } } : {}),
			...(process.platform === 'linux' ? { seccomp: { applyPath: seccompPath } } : {}),
		};
		return {
			config,
			fingerprint: process.platform === 'win32'
				? JSON.stringify({ allowRead, allowWrite, denyRead, denyWrite, network: config.network })
				: JSON.stringify({ network: config.network }),
		};
	}

	private async wrapReadOnly(command: string, commandId: string): Promise<SandboxedCommand> {
		await this.configuration();
		const permissions = getPermissions();
		const deniedReads = [...permissions.exec.deny, ...permissions.read.deny];
		await fs.mkdir(this.temporaryDirectory, { recursive: true });
		const settingsPath = path.join(this.temporaryDirectory, `${commandId}.json`);
		const readPaths = [
			currentWorkspace().files,
			this.temporaryDirectory,
			...sandboxSystemReads(),
			...(process.platform === 'linux' ? [this.vendoredSeccompPath()] : []),
		].filter((value) => !deniedReads.some((rule) => ruleMatches(rule, value)));
		const persistentDefaults = getDefaultWritePaths().filter(
			(value) => !value.startsWith('/dev/')
		);
		const config: SandboxRuntimeConfig = {
			network: {
				allowedDomains: [],
				deniedDomains: ['*'],
				allowLocalBinding: false,
				allowUnixSockets: [],
				allowAllUnixSockets: false,
			},
			filesystem: {
				denyRead: [path.parse(currentWorkspace().files).root, ...deniedReads.map((rule) => rule.root), ...protectedRoots().read],
				allowRead: readPaths,
				allowWrite: [this.temporaryDirectory],
				denyWrite: [currentWorkspace().files, ...persistentDefaults],
			},
			enableWeakerNestedSandbox: false,
			enableWeakerNetworkIsolation: false,
			allowAppleEvents: false,
			allowPty: false,
			...(process.platform === 'win32'
				? { windows: { srtWin: { path: this.vendoredWindowsPath() } } }
				: {}),
			...(process.platform === 'linux'
				? { seccomp: { applyPath: this.vendoredSeccompPath() } }
				: {}),
		};
		await fs.writeFile(settingsPath, JSON.stringify(config), { mode: 0o600 });
		this.readOnlySettings.set(commandId, settingsPath);
		const cliPath = this.unpackedPath(
			path.resolve(path.dirname(VENDORED_SRT_WIN_EXE), '..', '..', '..', 'dist', 'cli.js')
		);
		return {
			command: process.execPath,
			args: [cliPath, '--settings', settingsPath, '-c', command],
			env: {
				ELECTRON_RUN_AS_NODE: '1',
				HOME: this.temporaryDirectory,
				TMPDIR: this.temporaryDirectory,
				TMP: this.temporaryDirectory,
				TEMP: this.temporaryDirectory,
			},
			commandId,
		};
	}

	private async protectedWrites(roots: readonly string[], writable: readonly string[]): Promise<string[]> {
		const nested = await Promise.all(roots.map(async (root) => {
			if (writable.some((directory) => isPathWithin(directory, root))) return [];
			if (!writable.some((directory) => isPathWithin(root, directory))) return [root];
			const entries = await fs.readdir(root).catch(() => []);
			return this.protectedWrites(entries.map((entry) => path.join(root, entry)), writable);
		}));
		return nested.flat();
	}

	private vendoredWindowsPath(): string {
		return this.unpackedPath(VENDORED_SRT_WIN_EXE);
	}

	private vendoredSeccompPath(): string {
		return this.unpackedPath(
			path.resolve(
				path.dirname(VENDORED_SRT_WIN_EXE),
				'..',
				'..',
				'seccomp',
				process.arch,
				'apply-seccomp'
			)
		);
	}

	private unpackedPath(value: string): string {
		return value.replace(
			`${path.sep}app.asar${path.sep}`,
			`${path.sep}app.asar.unpacked${path.sep}`
		);
	}

	private async stopChildren(): Promise<void> {
		const children = [...this.children];
		await Promise.all(
			children.map(
				(child) =>
					new Promise<void>((resolve) => {
						if (!processTreeAlive(child)) {
							resolve();
							return;
						}
						const timer = setTimeout(resolve, 2_000);
						child.once('close', () => {
							clearTimeout(timer);
							resolve();
						});
						terminateProcessTree(child);
					})
			)
		);
		this.children.clear();
	}
}
