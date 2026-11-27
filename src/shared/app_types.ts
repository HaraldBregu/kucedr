export interface AppLogEntry {
	timestamp: string;
	level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
	source: string;
	message: string;
}

export interface ActivityDay {
	readonly date: string;
	readonly value: number;
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

export type WorkspaceTextSize = 'extra-small' | 'small' | 'medium' | 'large' | 'extra-large';

export const CHAT_TEXT_SIZES = ['extra-small', 'small', 'medium', 'large', 'extra-large'] as const;

export type ChatTextSize = (typeof CHAT_TEXT_SIZES)[number];

export const ZOOM_FACTORS = [1, 1.1, 1.25, 1.5, 1.75, 2] as const;

export type ZoomFactor = (typeof ZOOM_FACTORS)[number];

export type AppTheme = 'light' | 'dark' | 'system';

export const VOICE_AGENT_APPEARANCES = ['persona', 'radial', 'cloud', 'bars'] as const;

export type VoiceAgentAppearance = (typeof VOICE_AGENT_APPEARANCES)[number];

export const TRAY_CLICK_ACTIONS = ['toggle-chat', 'toggle-persona'] as const;

export type TrayClickAction = (typeof TRAY_CLICK_ACTIONS)[number];

export const UPDATE_CHANNELS = ['stable', 'beta', 'off'] as const;

export type UpdateChannel = (typeof UPDATE_CHANNELS)[number];

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

export const SHORTCUTS = [
	{ id: 'commandMenu', area: 'app', target: 'renderer', labelKey: 'commandMenu', accelerator: 'CmdOrCtrl+F', mac: '⌘F', win: 'Ctrl+F', linux: 'Ctrl+F' },
	{ id: 'settings', area: 'app', target: 'renderer', labelKey: 'settings', accelerator: 'Cmd+,', mac: '⌘,', win: '', linux: '' },
	{ id: 'newChat', area: 'chat', target: 'renderer', labelKey: 'newChat', accelerator: 'CmdOrCtrl+N', mac: '⌘N', win: 'Ctrl+N', linux: 'Ctrl+N' },
	{ id: 'focusComposer', area: 'chat', target: 'renderer', labelKey: 'focusComposer', accelerator: 'CmdOrCtrl+/', mac: '⌘/', win: 'Ctrl+/', linux: 'Ctrl+/' },
	{ id: 'chatHistory', area: 'chat', target: 'renderer', labelKey: 'chatHistory', accelerator: 'CmdOrCtrl+D', mac: '⌘D', win: 'Ctrl+D', linux: 'Ctrl+D' },
	{ id: 'newWindow', area: 'app', target: 'menu', labelKey: 'newWindow', accelerator: 'CmdOrCtrl+Shift+N', mac: '⌘⇧N', win: 'Ctrl+Shift+N', linux: 'Ctrl+Shift+N' },
	{ id: 'lockNow', area: 'app', target: 'menu', labelKey: 'lockNow', accelerator: 'CmdOrCtrl+Shift+L', mac: '⌘⇧L', win: 'Ctrl+Shift+L', linux: 'Ctrl+Shift+L' },
	{ id: 'zoomReset', area: 'app', target: 'menu', labelKey: 'zoomReset', accelerator: 'CmdOrCtrl+0', mac: '⌘0', win: 'Ctrl+0', linux: 'Ctrl+0' },
	{ id: 'zoomIn', area: 'app', target: 'menu', labelKey: 'zoomIn', accelerator: 'CmdOrCtrl+Plus', acceleratorAlias: 'CmdOrCtrl+=', mac: '⌘+', win: 'Ctrl++', linux: 'Ctrl++' },
	{ id: 'zoomOut', area: 'app', target: 'menu', labelKey: 'zoomOut', accelerator: 'CmdOrCtrl+-', mac: '⌘−', win: 'Ctrl+-', linux: 'Ctrl+-' },
	{ id: 'back', area: 'app', target: 'menu', labelKey: 'back', accelerator: 'Cmd+[', mac: '⌘[', win: '', linux: '' },
	{ id: 'forward', area: 'app', target: 'menu', labelKey: 'forward', accelerator: 'Cmd+]', mac: '⌘]', win: '', linux: '' },
	{ id: 'editorUndo', area: 'workspace', labelKey: 'editorUndo', tiptapKey: 'Mod-z', mac: '⌘Z', win: 'Ctrl+Z', linux: 'Ctrl+Z' },
	{ id: 'editorRedo', area: 'workspace', labelKey: 'editorRedo', tiptapKey: 'Mod-Shift-z', mac: '⌘⇧Z', win: 'Ctrl+Shift+Z', linux: 'Ctrl+Shift+Z' },
	{ id: 'editorHeading1', area: 'workspace', labelKey: 'editorHeading1', tiptapKey: 'Mod-Alt-1', mac: '⌘⌥1', win: 'Ctrl+Alt+1', linux: 'Ctrl+Alt+1' },
	{ id: 'editorHeading2', area: 'workspace', labelKey: 'editorHeading2', tiptapKey: 'Mod-Alt-2', mac: '⌘⌥2', win: 'Ctrl+Alt+2', linux: 'Ctrl+Alt+2' },
	{ id: 'editorHeading3', area: 'workspace', labelKey: 'editorHeading3', tiptapKey: 'Mod-Alt-3', mac: '⌘⌥3', win: 'Ctrl+Alt+3', linux: 'Ctrl+Alt+3' },
	{ id: 'editorBold', area: 'workspace', labelKey: 'editorBold', tiptapKey: 'Mod-b', mac: '⌘B', win: 'Ctrl+B', linux: 'Ctrl+B' },
	{ id: 'editorItalic', area: 'workspace', labelKey: 'editorItalic', tiptapKey: 'Mod-i', mac: '⌘I', win: 'Ctrl+I', linux: 'Ctrl+I' },
	{ id: 'editorUnderline', area: 'workspace', labelKey: 'editorUnderline', tiptapKey: 'Mod-u', mac: '⌘U', win: 'Ctrl+U', linux: 'Ctrl+U' },
	{ id: 'editorStrikethrough', area: 'workspace', labelKey: 'editorStrikethrough', tiptapKey: 'Mod-Shift-s', mac: '⌘⇧S', win: 'Ctrl+Shift+S', linux: 'Ctrl+Shift+S' },
	{ id: 'editorInlineCode', area: 'workspace', labelKey: 'editorInlineCode', tiptapKey: 'Mod-e', mac: '⌘E', win: 'Ctrl+E', linux: 'Ctrl+E' },
	{ id: 'editorClearFormatting', area: 'workspace', labelKey: 'editorClearFormatting', tiptapKey: 'Mod-\\', mac: '⌘\\', win: 'Ctrl+\\', linux: 'Ctrl+\\' },
	{ id: 'editorBulletedList', area: 'workspace', labelKey: 'editorBulletedList', tiptapKey: 'Mod-Shift-8', mac: '⌘⇧8', win: 'Ctrl+Shift+8', linux: 'Ctrl+Shift+8' },
	{ id: 'editorNumberedList', area: 'workspace', labelKey: 'editorNumberedList', tiptapKey: 'Mod-Shift-7', mac: '⌘⇧7', win: 'Ctrl+Shift+7', linux: 'Ctrl+Shift+7' },
	{ id: 'editorTaskList', area: 'workspace', labelKey: 'editorTaskList', tiptapKey: 'Mod-Shift-9', mac: '⌘⇧9', win: 'Ctrl+Shift+9', linux: 'Ctrl+Shift+9' },
	{ id: 'editorQuote', area: 'workspace', labelKey: 'editorQuote', tiptapKey: 'Mod-Shift-b', mac: '⌘⇧B', win: 'Ctrl+Shift+B', linux: 'Ctrl+Shift+B' },
	{ id: 'editorCodeBlock', area: 'workspace', labelKey: 'editorCodeBlock', tiptapKey: 'Mod-Alt-c', mac: '⌘⌥C', win: 'Ctrl+Alt+C', linux: 'Ctrl+Alt+C' },
	{ id: 'editorSave', area: 'workspace', labelKey: 'editorSave', tiptapKey: 'Mod-s', mac: '⌘S', win: 'Ctrl+S', linux: 'Ctrl+S' },
	{ id: 'editorLink', area: 'workspace', labelKey: 'editorLink', tiptapKey: 'Mod-k', mac: '⌘K', win: 'Ctrl+K', linux: 'Ctrl+K' },
	{ id: 'editorInsertFile', area: 'workspace', labelKey: 'editorInsertFile', tiptapKey: 'Mod-Shift-i', mac: '⌘⇧I', win: 'Ctrl+Shift+I', linux: 'Ctrl+Shift+I' },
	{ id: 'browserMoveTabLeft', area: 'browser', labelKey: 'browserMoveTabLeft', tiptapKey: 'Mod-Shift-ArrowLeft', mac: '⌘⇧←', win: 'Ctrl+Shift+←', linux: 'Ctrl+Shift+←' },
	{ id: 'browserMoveTabRight', area: 'browser', labelKey: 'browserMoveTabRight', tiptapKey: 'Mod-Shift-ArrowRight', mac: '⌘⇧→', win: 'Ctrl+Shift+→', linux: 'Ctrl+Shift+→' },
] as const;

export type ShortcutId = (typeof SHORTCUTS)[number]['id'];
export type ShortcutArea = (typeof SHORTCUTS)[number]['area'];

export function getShortcutLabel(id: ShortcutId, platform: 'mac' | 'win' | 'linux'): string {
	return SHORTCUTS.find((shortcut) => shortcut.id === id)?.[platform] ?? '';
}

export function getShortcutAccelerator(id: ShortcutId, alias = false): string | undefined {
	const shortcut = SHORTCUTS.find((item) => item.id === id);
	return alias ? ('acceleratorAlias' in shortcut! ? shortcut.acceleratorAlias : undefined) : ('accelerator' in shortcut! ? shortcut.accelerator : undefined);
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
