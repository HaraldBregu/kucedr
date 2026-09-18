export interface WorkspaceSettings {
	fontSize: number;
	formatted: boolean;
	lineNumbers: boolean;
	wordWrap: boolean;
}

export const workspaceSettingsDefaults: WorkspaceSettings = {
	fontSize: 13,
	formatted: false,
	lineNumbers: true,
	wordWrap: false,
};

export const workspaceSettingsKey = 'workspace.settings';
