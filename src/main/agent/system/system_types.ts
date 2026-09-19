export const AGENT_FILE = 'AGENTS.md' as const;
export const BOOTSTRAP_FILE = 'BOOTSTRAP.md' as const;
export const HEALTH_FILE = 'HEALTH.md' as const;
export const IDENTITY_FILE = 'IDENTITY.md' as const;
export const SOUL_FILE = 'SOUL.md' as const;
export const USER_FILE = 'USER.md' as const;

export type WorkspaceFile =
	| typeof AGENT_FILE
	| typeof BOOTSTRAP_FILE
	| typeof HEALTH_FILE
	| typeof IDENTITY_FILE
	| typeof SOUL_FILE
	| typeof USER_FILE;

export const WORKSPACE_FILES = [
	AGENT_FILE,
	BOOTSTRAP_FILE,
	HEALTH_FILE,
	IDENTITY_FILE,
	SOUL_FILE,
	USER_FILE,
] as const satisfies readonly WorkspaceFile[];
