export interface AppLogEntry {
	timestamp: string;
	level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
	source: string;
	message: string;
}

export type MicrophoneSystemPermissionStatus =
	| 'not-determined'
	| 'granted'
	| 'denied'
	| 'restricted'
	| 'unknown'
	| 'unsupported';

export interface MicrophonePermissionSettings {
	readonly enabled: boolean;
	readonly systemStatus: MicrophoneSystemPermissionStatus;
	readonly canRequest: boolean;
}

export type CameraSystemPermissionStatus =
	| 'not-determined'
	| 'granted'
	| 'denied'
	| 'restricted'
	| 'unknown'
	| 'unsupported';

export interface CameraPermissionSettings {
	readonly enabled: boolean;
	readonly systemStatus: CameraSystemPermissionStatus;
	readonly canRequest: boolean;
}

export interface ScreenCapturePermissionSettings {
	readonly systemStatus: MicrophoneSystemPermissionStatus;
	readonly requiresRelaunch: boolean;
}

export type SystemPreferencePaneId = 'Accessibility' | 'ScreenCapture' | 'Camera' | 'Microphone';

export type AppLanguage = 'en' | 'it';

export type AppTheme = 'light' | 'dark' | 'system';

export const TRAY_CLICK_ACTIONS = ['toggle-chat', 'start-persona', 'toggle-persona'] as const;

export type TrayClickAction = (typeof TRAY_CLICK_ACTIONS)[number];

export type AppThemeColors = Record<string, string>;

export interface AppThemeData {
	readonly themeMode: AppTheme;
	readonly isDark: boolean;
	readonly colors: AppThemeColors;
}

export interface AppLaunchState {
	readonly launchCount: number;
	readonly isFirstLaunch: boolean;
}

export interface UrlMetadata {
	readonly title: string;
	readonly description: string;
	readonly image: string;
	readonly favicon: string;
}

export const ShortcutId = {
	openDocumentList: 'openDocumentList',
	openAppSearch: 'openAppSearch',
	newDocument: 'newDocument',
} as const;

export type ShortcutId = (typeof ShortcutId)[keyof typeof ShortcutId];

export interface ShortcutBinding {
	mac: string;
	win: string;
	linux: string;
}

export const SHORTCUT_BINDINGS: Record<ShortcutId, ShortcutBinding> = {
	[ShortcutId.openDocumentList]: {
		mac: '⌘D',
		win: 'Ctrl+D',
		linux: 'Ctrl+D',
	},
	[ShortcutId.openAppSearch]: {
		mac: '⌘K',
		win: 'Ctrl+K',
		linux: 'Ctrl+K',
	},
	[ShortcutId.newDocument]: {
		mac: '⌃⌥N',
		win: 'Ctrl+Alt+N',
		linux: 'Ctrl+Alt+N',
	},
};

export const SHORTCUT_ACCELERATORS: Record<ShortcutId, string> = {
	[ShortcutId.openDocumentList]: 'CmdOrCtrl+D',
	[ShortcutId.openAppSearch]: 'CmdOrCtrl+K',
	[ShortcutId.newDocument]: 'Ctrl+Alt+N',
};

export function getShortcutLabel(id: ShortcutId, platform: 'mac' | 'win' | 'linux'): string {
	const binding = SHORTCUT_BINDINGS[id];
	return binding[platform];
}

export interface ModelModuleSettings {
	providerId: string;
	modelId: string;
	options?: Record<string, unknown>;
}

export type AssistantSettings = ModelModuleSettings;

export interface AgentModuleOptions {
	agentRuntime?: string;
	[key: string]: unknown;
}

export interface TaskSettings {
	allowedTaskTypes?: string[];
	defaultConcurrency?: number;
}

export interface AgentToolPolicy {
	profile?: 'minimal' | 'coding' | 'messaging' | 'full';
	allow?: string[];
	alsoAllow?: string[];
	deny?: string[];
	fs?: { workspaceOnly?: boolean; writeWorkspaceOnly?: boolean; readOnly?: boolean };
	exec?: Record<string, unknown>;
}

export interface AgentConfig {
	id: string;
	default?: boolean;
	name?: string;
	workspace?: string;
	model?: {
		providerId?: string;
		modelId?: string;
	};
	skills?: string[];
	tools?: AgentToolPolicy;
}

export type AgentRoutePeerKind = 'direct' | 'group' | 'channel' | 'thread';

export interface AgentRoutePeer {
	kind: AgentRoutePeerKind;
	id: string;
}

export interface AgentParentRoutePeer {
	kind: Exclude<AgentRoutePeerKind, 'thread'>;
	id: string;
}

export type AgentRouteSessionScope =
	| 'main'
	| 'per-peer'
	| 'per-channel-peer'
	| 'per-account-channel-peer';

export interface AgentRouteBinding {
	agentId: string;
	match: {
		channel?: string;
		accountId?: string;
		peer?: AgentRoutePeer;
		parentPeer?: AgentParentRoutePeer;
		roleIds?: string[];
	};
	session?: {
		scope?: AgentRouteSessionScope;
	};
}

export interface AgentsSettings {
	agents: AgentConfig[];
	bindings: AgentRouteBinding[];
}

export type AgentRoutingSettings = AgentsSettings;
