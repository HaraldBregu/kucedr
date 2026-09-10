export const AgentChannels = {
	send: 'agent:send',
	response: 'agent:response',
	cancel: 'agent:cancel',
	respondToolPermission: 'agent:respond-tool-permission',
	respondUserInput: 'agent:respond-user-input',
	getPromptInputCapabilities: 'agent:prompt-input-capabilities:get',
	listSessions: 'agent:list-sessions',
	openSessionsFolder: 'agent:sessions:open-folder',
	renameSession: 'agent:rename-session',
	lastMessages: 'agent:last-messages',
	sessionSnapshot: 'agent:session-snapshot',
	editUserMessage: 'agent:edit-user-message',
	clearMessages: 'agent:clear-messages',
	deleteSession: 'agent:delete-session',
	getWorkspaceLocation: 'agent:workspace:location:get',
	listWorkspaceFiles: 'agent:workspace:files:list',
	workspaceChanged: 'agent:workspace:changed',
	readWorkspaceFile: 'agent:workspace:file:read',
	readWorkspaceAsset: 'agent:workspace:asset:read',
	writeWorkspaceFile: 'agent:workspace:file:write',
	writeWorkspaceMarkdown: 'agent:workspace:markdown:write',
	createWorkspaceFile: 'agent:workspace:file:create',
	createWorkspaceDirectory: 'agent:workspace:directory:create',
	moveWorkspaceEntry: 'agent:workspace:entry:move',
	renameWorkspaceEntry: 'agent:workspace:entry:rename',
	deleteWorkspaceFile: 'agent:workspace:file:delete',
	deleteWorkspaceDirectory: 'agent:workspace:directory:delete',
	getProvider: 'agent:get-provider',
	setProvider: 'agent:set-provider',
	getModelId: 'agent:get-model-id',
	setModelId: 'agent:set-model-id',
	getModelOptions: 'agent:get-model-options',
	setModelOptions: 'agent:set-model-options',
	policyGet: 'agent:policy:get',
	policySet: 'agent:policy:set',
	policyReset: 'agent:policy:reset',
	policyPickDirectory: 'agent:policy:directory:pick',
	policyNormalizeDirectory: 'agent:policy:directory:normalize',
	healthSettings: 'agent:health:settings',
	healthSaveSettings: 'agent:health:settings:save',
	healthResetSettings: 'agent:health:settings:reset',
	healthData: 'agent:health:data',
	healthSaveData: 'agent:health:data:save',
	ragIndex: 'agent:rag:index',
	ragGetConfiguration: 'agent:rag:configuration:get',
	ragSaveConfiguration: 'agent:rag:configuration:save',
	ragSearch: 'agent:rag:search',
	ragPickFolder: 'agent:rag:folder:pick',
} as const;

export const CoderChannels = {
	getSettings: 'coder:settings:get',
	saveSettings: 'coder:settings:save',
	listModels: 'coder:models:list',
	listProjects: 'coder:projects:list',
	addProject: 'coder:projects:add',
	openProject: 'coder:projects:open',
	removeProject: 'coder:projects:remove',
	getProjectInstructions: 'coder:projects:instructions:get',
	saveProjectInstructions: 'coder:projects:instructions:save',
	listSessions: 'coder:sessions:list',
	getSession: 'coder:sessions:get',
	renameSession: 'coder:sessions:rename',
	deleteSession: 'coder:sessions:delete',
	send: 'coder:send',
	response: 'coder:response',
	cancel: 'coder:cancel',
	connectCodex: 'coder:codex:connect',
	cancelCodexLogin: 'coder:codex:connect:cancel',
	disconnectCodex: 'coder:codex:disconnect',
	authEvent: 'coder:auth:event',
} as const;

export const RecorderChannels = {
	microphone: {
		start: 'recorder:microphone:start',
		stop: 'recorder:microphone:stop',
		cancel: 'recorder:microphone:cancel',
		list: 'recorder:microphone:list',
		complete: 'recorder:microphone:complete',
		chunk: 'recorder:microphone:chunk',
		command: 'recorder:microphone:command',
		event: 'recorder:microphone:event',
	},
	camera: {
		start: 'recorder:camera:start',
		stop: 'recorder:camera:stop',
		cancel: 'recorder:camera:cancel',
		list: 'recorder:camera:list',
		complete: 'recorder:camera:complete',
		chunk: 'recorder:camera:chunk',
		command: 'recorder:camera:command',
		event: 'recorder:camera:event',
	},
	screen: {
		start: 'recorder:screen:start',
		stop: 'recorder:screen:stop',
		cancel: 'recorder:screen:cancel',
		list: 'recorder:screen:list',
		complete: 'recorder:screen:complete',
		chunk: 'recorder:screen:chunk',
		command: 'recorder:screen:command',
		event: 'recorder:screen:event',
	},
} as const;

export const TaskChannels = {
	list: 'tasks:list',
	runNow: 'tasks:run-now',
	delete: 'tasks:delete',
	getRuntime: 'tasks:runtime:get',
	setRuntime: 'tasks:runtime:set',
	configureCapabilities: 'tasks:capabilities:configure',
} as const;

export const SkillsChannels = {
	list: 'skills:list',
	load: 'skills:load',
	import: 'skills:import',
	download: 'skills:download',
	delete: 'skills:delete',
	openRoot: 'skills:open-root',
	getRoot: 'skills:get-root',
} as const;

export const A2aChannels = {
	list: 'a2a:list',
	save: 'a2a:save',
	delete: 'a2a:delete',
	test: 'a2a:test',
} as const;

export const McpChannels = {
	list: 'mcp:list',
	get: 'mcp:get',
	save: 'mcp:save',
	upsert: 'mcp:upsert',
	delete: 'mcp:delete',
	registry: 'mcp:registry',
	importLocal: 'mcp:local:import',
	configureLocal: 'mcp:local:configure',
	getRoot: 'mcp:local:root',
	openRoot: 'mcp:local:open',
	test: 'mcp:test',
	oauthStart: 'mcp:oauth:start',
	oauthFinish: 'mcp:oauth:finish',
} as const;

export const AppChannels = {
	openAppDataFolder: 'app:open-app-data-folder',
	openDataFolder: 'app:open-data-folder',
	openProvidersFolder: 'app:open-providers-folder',
	openExternalUrl: 'app:open-external-url',
	unfurlUrl: 'app:unfurl-url',
	openSystemPreference: 'app:open-system-preference',
	setTrayEnabled: 'app:set-tray-enabled',
	getTrayEnabled: 'app:get-tray-enabled',
	getLaunchState: 'app:get-launch-state',
	trayEnabledChanged: 'app:tray-enabled-changed',
	setKeepAwake: 'app:set-keep-awake',
	getKeepAwake: 'app:get-keep-awake',
	keepAwakeChanged: 'app:keep-awake-changed',
	setLanguage: 'app:set-language',
	getLanguage: 'app:get-language',
	setTheme: 'app:set-theme',
	getTheme: 'app:get-theme',
	getThemeData: 'app:get-theme-data',
	themeModeChanged: 'app:theme-mode-changed',
	getSandboxStatus: 'app:sandbox:status:get',
	setupSandbox: 'app:sandbox:setup',
	getMicrophoneInputId: 'app:get-microphone-input-id',
	setMicrophoneInputId: 'app:set-microphone-input-id',
	getMicrophonePermission: 'app:get-microphone-permission',
	setMicrophoneEnabled: 'app:set-microphone-enabled',
	requestMicrophonePermission: 'app:request-microphone-permission',
	getCameraPermission: 'app:get-camera-permission',
	setCameraEnabled: 'app:set-camera-enabled',
	requestCameraPermission: 'app:request-camera-permission',
	getScreenCapturePermission: 'app:get-screen-capture-permission',
	requestScreenCapturePermission: 'app:request-screen-capture-permission',
	openVideo: 'app:open-video',
	showImageContextMenu: 'app:show-image-context-menu',
	showVideoContextMenu: 'app:show-video-context-menu',
	showAudioContextMenu: 'app:show-audio-context-menu',
	models: 'app:models',
	databases: 'app:databases',
	webSearches: 'app:web-searches',
	mcps: 'app:mcps',
	channels: 'app:channels:list',
	getChannelModelSelection: 'app:channels:model-selection:get',
	setChannelModelSelection: 'app:channels:model-selection:set',
	modelsChanged: 'app:models-changed',
	uploadProvider: 'app:upload-provider',
	getChannelsStatus: 'app:channels:get-status',
	startTelegram: 'app:channels:telegram:start',
	stopTelegram: 'app:channels:telegram:stop',
	restartTelegram: 'app:channels:telegram:restart',
	channelsStatusChanged: 'app:channels:status-changed',
	getAppStoreValue: 'app:app-store:value:get',
	setAppStoreValue: 'app:app-store:value:set',
	deleteAppStoreValue: 'app:app-store:value:delete',
	readAppStoreFile: 'app:app-store:file:read',
	writeAppStoreFile: 'app:app-store:file:write',
	deleteAppStoreFile: 'app:app-store:file:delete',
} as const;

export const AuthChannels = {
	getState: 'auth:state:get',
	getProfile: 'auth:profile:get',
	updateProfile: 'auth:profile:update',
	signIn: 'auth:sign-in',
	signInWithGoogle: 'auth:sign-in:google',
	signUp: 'auth:sign-up',
	resendConfirmation: 'auth:confirmation:resend',
	requestPasswordReset: 'auth:password:reset-request',
	updatePassword: 'auth:password:update',
	signOut: 'auth:sign-out',
	stateChanged: 'auth:state:changed',
} as const;

export const CloudChannels = {
	listSessions: 'cloud:sessions:list',
	upsertSession: 'cloud:sessions:upsert',
	deleteSession: 'cloud:sessions:delete',
	listMessages: 'cloud:messages:list',
	upsertMessage: 'cloud:messages:upsert',
	uploadFile: 'cloud:files:upload',
	downloadFile: 'cloud:files:download',
	deleteFile: 'cloud:files:delete',
	watchSession: 'cloud:session:watch',
	unwatchSession: 'cloud:session:unwatch',
	sessionChanged: 'cloud:session:changed',
} as const;

export const EmbeddingChannels = {
	createEmbedding: 'embedding:create-embedding',
	getModelId: 'embedding:get-model-id',
	getProviderId: 'embedding:get-provider-id',
	setModelId: 'embedding:set-model-id',
	setProviderId: 'embedding:set-provider-id',
} as const;

export const ImageChannels = {
	createImage: 'image:create-image',
	getOptions: 'image:get-options',
	getModelId: 'image:get-model-id',
	getProviderId: 'image:get-provider-id',
	setOptions: 'image:set-options',
	setModelId: 'image:set-model-id',
	setProviderId: 'image:set-provider-id',
} as const;

export const SoundChannels = {
	createSound: 'sound:create-sound',
	listSounds: 'sound:list-sounds',
	getOptions: 'sound:get-options',
	getModelId: 'sound:get-model-id',
	getProviderId: 'sound:get-provider-id',
	setOptions: 'sound:set-options',
	setModelId: 'sound:set-model-id',
	setProviderId: 'sound:set-provider-id',
} as const;

export const ProviderChannels = {
	get: 'provider-store:get',
	set: 'provider-store:set',
	list: 'provider-store:list',
	getChannel: 'provider-store:channel:get',
	setChannel: 'provider-store:channel:set',
	listChannels: 'provider-store:channel:list',
	vaultStatus: 'provider-store:vault:status',
	setupVault: 'provider-store:vault:setup',
	unlockVault: 'provider-store:vault:unlock',
	changeVaultPassphrase: 'provider-store:vault:change-passphrase',
	syncVault: 'provider-store:vault:sync',
} as const;

export const ProviderStoreChannels = ProviderChannels;

export const StorageChannels = {
	listProviders: 'storage:providers:list',
	saveProvider: 'storage:providers:save',
	removeProvider: 'storage:providers:remove',
	getSettings: 'storage:settings:get',
	saveSettings: 'storage:settings:save',
	syncFolders: 'storage:sync-folders',
	pickFolders: 'storage:pick-folders',
	getOperationStatus: 'storage:operation-status:get',
	operationStatusChanged: 'storage:operation-status:changed',
	backup: 'storage:backup',
	restore: 'storage:restore',
} as const;

export const DatabaseChannels = {
	getConfiguration: 'database:configuration:get',
	saveConfiguration: 'database:configuration:save',
} as const;

export const SearchChannels = {
	getSettings: 'search:settings:get',
	saveEngine: 'search:engine:save',
	selectEngine: 'search:engine:select',
} as const;

export const WikiChannels = {
	getSettings: 'wiki:settings:get',
	getStatus: 'wiki:status:get',
	saveSettings: 'wiki:settings:save',
	run: 'wiki:run',
	cancel: 'wiki:cancel',
	pickDirectory: 'wiki:directory:pick',
	openDirectory: 'wiki:directory:open',
} as const;

export const DataChannels = {
	listScopes: 'data:scopes:list',
	export: 'data:export',
	previewPurge: 'data:purge:preview',
	purge: 'data:purge',
} as const;

export const SpeechChannels = {
	getOptions: 'speech:get-options',
	getModelId: 'speech:get-model-id',
	getProviderId: 'speech:get-provider-id',
	setOptions: 'speech:set-options',
	setModelId: 'speech:set-model-id',
	setProviderId: 'speech:set-provider-id',
	synthesize: 'speech:synthesize',
} as const;

export const RealtimeVoiceChannels = {
	appendAudio: 'realtime-voice:append-audio',
	getSetup: 'realtime-voice:setup:get',
	getModelId: 'realtime-voice:get-model-id',
	getOptions: 'realtime-voice:get-options',
	getProviderId: 'realtime-voice:get-provider-id',
	interruptSession: 'realtime-voice:interrupt-session',
	sessionEvent: 'realtime-voice:session-event',
	setModelId: 'realtime-voice:set-model-id',
	setOptions: 'realtime-voice:set-options',
	setProviderId: 'realtime-voice:set-provider-id',
	setSetup: 'realtime-voice:setup:set',
	startSession: 'realtime-voice:start-session',
	stopSession: 'realtime-voice:stop-session',
} as const;

export const SttChannels = {
	appendRealtimeAudio: 'stt:append-realtime-audio',
	cancelRealtime: 'stt:cancel-realtime',
	finishRealtime: 'stt:finish-realtime',
	getModelId: 'stt:get-model-id',
	getProviderId: 'stt:get-provider-id',
	getSelection: 'stt:get-selection',
	listModels: 'stt:list-models',
	listProviders: 'stt:list-providers',
	realtimeEvent: 'stt:realtime-event',
	saveSelection: 'stt:save-selection',
	setModelId: 'stt:set-model-id',
	setProviderId: 'stt:set-provider-id',
	startRealtime: 'stt:start-realtime',
	transcribe: 'stt:transcribe',
} as const;

export const TextChannels = {
	generateText: 'text:generate-text',
	getModelId: 'text:get-model-id',
	getProviderId: 'text:get-provider-id',
	setModelId: 'text:set-model-id',
	setProviderId: 'text:set-provider-id',
} as const;

export const VideoChannels = {
	createVideo: 'video:create-video',
	getOptions: 'video:get-options',
	getModelId: 'video:get-model-id',
	getProviderId: 'video:get-provider-id',
	setOptions: 'video:set-options',
	setModelId: 'video:set-model-id',
	setProviderId: 'video:set-provider-id',
} as const;

export const AppsChannels = {
	getSettings: 'apps:get-settings',
	setSettings: 'apps:set-settings',
	list: 'apps:list',
	open: 'apps:open',
	openRoot: 'apps:open-root',
	delete: 'apps:delete',
	import: 'apps:import',
} as const;

export const WindowChannels = {
	minimize: 'window:minimize',
	maximize: 'window:maximize',
	close: 'window:close',
	isMaximized: 'window:is-maximized',
	isFullScreen: 'window:is-fullscreen',
	maximizeChange: 'window:maximize-change',
	fullScreenChange: 'window:fullscreen-change',
	titlebarOptionsSet: 'window:titlebar-options:set',
	titlebarOptionsChanged: 'window:titlebar-options:changed',
	titlebarButtonClick: 'window:titlebar-button:click',
	titlebarButtonClicked: 'window:titlebar-button:clicked',
	titlebarSidebarWidthSet: 'window:titlebar-sidebar-width:set',
	titlebarSidebarWidthChanged: 'window:titlebar-sidebar-width:changed',
	popupMenu: 'window:popup-menu',
	showContextMenu: 'window:context-menu:show',
} as const;

export const TerminalChannels = {
	create: 'terminal:create',
	write: 'terminal:write',
	resize: 'terminal:resize',
	kill: 'terminal:kill',
	data: 'terminal:data',
	exit: 'terminal:exit',
} as const;
