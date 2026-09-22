import { accessSync, constants } from 'node:fs';
import path from 'node:path';

export interface DetectedShell {
	readonly executable: string;
	readonly args: string[];
}

type ExecutableCheck = (executable: string) => boolean;

export class ShellDetector {
	constructor(
		private readonly platform: NodeJS.Platform = process.platform,
		private readonly environment: NodeJS.ProcessEnv = process.env,
		private readonly isExecutable: ExecutableCheck = (executable) => {
			try {
				accessSync(executable, constants.X_OK);
				return true;
			} catch {
				return false;
			}
		}
	) {}

	detect(): DetectedShell {
		if (this.platform === 'win32') return this.detectWindowsShell();

		const candidates = [this.environment.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh'];
		const executable = candidates.find(
			(candidate): candidate is string => Boolean(candidate && this.isExecutable(candidate))
		);
		if (!executable) throw new Error('No supported shell executable was found.');
		return { executable, args: this.platform === 'darwin' ? ['-l'] : [] };
	}

	private detectWindowsShell(): DetectedShell {
		const systemRoot = this.environment.SystemRoot ?? this.environment.WINDIR ?? 'C:\\Windows';
		const candidates = [
			'pwsh.exe',
			path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
			this.environment.ComSpec,
			path.win32.join(systemRoot, 'System32', 'cmd.exe'),
		];
		for (const candidate of candidates) {
			if (!candidate) continue;
			const executable = this.resolveWindowsExecutable(candidate);
			if (!executable) continue;
			const name = path.win32.basename(executable).toLowerCase();
			return {
				executable,
				args: name === 'pwsh.exe' || name === 'powershell.exe' ? ['-NoLogo'] : [],
			};
		}
		throw new Error('PowerShell and Command Prompt are unavailable.');
	}

	private resolveWindowsExecutable(candidate: string): string | undefined {
		if (path.win32.isAbsolute(candidate)) return this.isExecutable(candidate) ? candidate : undefined;
		const pathValue = this.environment.PATH ?? this.environment.Path ?? '';
		for (const directory of pathValue.split(';').filter(Boolean)) {
			const executable = path.win32.join(directory, candidate);
			if (this.isExecutable(executable)) return executable;
		}
		return undefined;
	}
}
