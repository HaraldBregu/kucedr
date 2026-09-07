import { processTreeAlive } from './execution/alive';
import { terminateProcessTree } from './execution/terminate';
import fs from 'node:fs/promises';
import os from 'node:os';
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
import { resolveUserPath } from '../shared/user_path';
import { permissionFor } from './permissions/permission_for';
import { permissionRuleRoot } from './permissions/permission_rule_root';
import { recursivePermissionRule } from './permissions/recursive_permission_rule';
import type { AgentInteractionMode } from '../../shared/agent_types';
import { agentLocation } from '../shared/agent_location';
import { sandboxSystemReads } from './sandbox/reads';
import { realPath } from '../shared/real_path';
import { isPathWithin } from './permissions/permissions_path';

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
	private readonly planSettings = new Map<string, string>();

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
		interactionMode: AgentInteractionMode = 'default'
	): Promise<SandboxedCommand> {
		if (interactionMode === 'plan') return this.wrapPlan(command, commandId);
		await this.ensureReady();
		if (process.platform === 'win32' && approvedRoots.length > 0) {
			throw new Error(
				'One-time access to an outside location is unavailable on Windows. Trust the location to continue.'
			);
		}
		const { config } = await this.configuration(approvedRoots);
		const approvedPatterns = approvedRoots.map(recursivePermissionRule);
		const customConfig = process.platform !== 'win32' || approvedPatterns.length > 0
			? {
					filesystem: {
						...config.filesystem,
						allowRead: [...(config.filesystem.allowRead ?? []), ...approvedPatterns],
						allowWrite: [...(config.filesystem.allowWrite ?? []), ...approvedPatterns],
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
				...wrapped.env,
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
		const annotated = SandboxManager.annotateStderrWithSandboxFailures(commandId, stderr);
		if (annotated !== stderr) {
			return `${annotated}\nA sandbox restriction blocked this operation. Declare the outside directory in additionalRoots to request access.`;
		}
		if (/operation not permitted|permission denied|\bEPERM\b/i.test(stderr)) {
			return `${stderr}\nA filesystem sandbox may have blocked this operation. Declare the outside directory in additionalRoots to request access.`;
		}
		return stderr;
	}

	cleanup(commandId?: string): void {
		if (commandId) {
			const settings = this.planSettings.get(commandId);
			if (settings) {
				this.planSettings.delete(commandId);
				void fs.unlink(settings).catch(() => undefined);
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
				await SandboxManager.initialize(config);
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
		const resolveRules = (rules: string[]): string[] =>
			rules.map((rule) => rule === '*' ? path.parse(os.homedir()).root : resolveUserPath(rule, os.homedir()));
		const explicitReadDenies = resolveRules([...permissions.exec.deny, ...permissions.read.deny]);
		const explicitWriteDenies = resolveRules([...permissions.exec.deny, ...permissions.write.deny]);
		if ([...explicitReadDenies, ...explicitWriteDenies].some((rule) => /[*?[\]{}]/.test(rule.replace(/[\\/]\*\*$/, ''))))
			throw new Error('Command sandbox rules must use exact paths or a trailing /**. Refine the blocked pattern before executing commands.');
		const allowWrite = [
			...resolveRules(permissions.exec.allow),
			this.temporaryDirectory,
		];
		const denyWrite = [
			...explicitWriteDenies,
			...getDefaultWritePaths().filter((value) =>
				!value.startsWith('/dev/') &&
				permissionFor({ allow: [...allowWrite, ...approvedRoots.map(recursivePermissionRule)], deny: [] }, value, 'write') !== 'allow'
			),
		];
		const denyRead = explicitReadDenies;
		const allowRead: string[] = [];
		const windowsPath = this.vendoredWindowsPath();
		const seccompPath = this.vendoredSeccompPath();
		const config: SandboxRuntimeConfig = {
			network: {
				allowedDomains: ['*'],
				deniedDomains: [],
				allowLocalBinding: true,
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
				? JSON.stringify({ allowRead, allowWrite, denyRead, denyWrite })
				: 'sandbox-runtime-v2',
		};
	}

	private async wrapPlan(command: string, commandId: string): Promise<SandboxedCommand> {
		await this.configuration();
		const permissions = getPermissions();
		const deniedReads = [...permissions.exec.deny, ...permissions.read.deny];
		await fs.mkdir(this.temporaryDirectory, { recursive: true });
		const settingsPath = path.join(this.temporaryDirectory, `${commandId}.json`);
		const readPaths = [
			agentLocation(),
			this.temporaryDirectory,
			...sandboxSystemReads(),
			...(process.platform === 'linux' ? [this.vendoredSeccompPath()] : []),
		].filter((value) =>
			permissionFor({ allow: [], deny: deniedReads }, value, 'read') !== 'deny'
		);
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
				denyRead: [path.parse(agentLocation()).root, ...deniedReads.map((rule) => rule === '*' ? path.parse(agentLocation()).root : resolveUserPath(rule, os.homedir()))],
				allowRead: readPaths,
				allowWrite: [this.temporaryDirectory],
				denyWrite: [agentLocation(), ...persistentDefaults],
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
		this.planSettings.set(commandId, settingsPath);
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
