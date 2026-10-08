export const BOOTSTRAP_FILE = 'BOOTSTRAP.md' as const;
export const IDENTITY_FILE = 'IDENTITY.md' as const;
export const SOUL_FILE = 'SOUL.md' as const;
export const USER_FILE = 'USER.md' as const;

export type WorkspaceFile =
	| typeof BOOTSTRAP_FILE
	| typeof IDENTITY_FILE
	| typeof SOUL_FILE
	| typeof USER_FILE;

export const WORKSPACE_FILES = [
	BOOTSTRAP_FILE,
] as const satisfies readonly WorkspaceFile[];
