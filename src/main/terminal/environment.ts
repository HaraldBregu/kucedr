import { shellEnv } from 'shell-env';
import type { LoggerService } from '../shared';

type ShellEnvironmentReader = (shell?: string) => Promise<Readonly<Record<string, string>>>;

const loginEnvironmentTimeout = 5000;

export class EnvironmentManager {
	private loginEnvironment?: Promise<Readonly<Record<string, string>>>;

	constructor(
		private readonly logger: Pick<LoggerService, 'warn'>,
		private readonly platform: NodeJS.Platform = process.platform,
		private readonly environment: NodeJS.ProcessEnv = process.env,
		private readonly readShellEnvironment: ShellEnvironmentReader = shellEnv
	) {}

	async get(shell: string): Promise<Record<string, string>> {
		const inherited = this.toStringRecord(this.environment);
		let login: Readonly<Record<string, string>> = {};

		if (this.platform === 'darwin') {
			this.loginEnvironment ??= this.readShellEnvironment(shell).catch((error: unknown) => {
				this.logger.warn('EnvironmentManager', 'Unable to read the login-shell environment', {
					error: error instanceof Error ? error.message : String(error),
				});
				return {};
			});
			login = await this.loginEnvironment;
		}

		return {
			...inherited,
			...login,
			TERM: 'xterm-256color',
			COLORTERM: 'truecolor',
			TERM_PROGRAM: 'Kucedr',
		};
	}

	private toStringRecord(environment: NodeJS.ProcessEnv): Record<string, string> {
		return Object.fromEntries(
			Object.entries(environment).filter((entry): entry is [string, string] => {
				return typeof entry[1] === 'string';
			})
		);
	}
}
