export interface WorkspaceSettings {
	fontSize: number;
	lineNumbers: boolean;
	wordWrap: boolean;
}

export const workspaceSettingsDefaults: WorkspaceSettings = {
	fontSize: 13,
	lineNumbers: true,
	wordWrap: false,
};

export const workspaceSettingsKey = 'workspace.settings';
