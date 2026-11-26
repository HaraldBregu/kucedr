import {
	AudioLines,
	ChartNoAxesColumnIncreasing,
	BookOpenText,
	Brain,
	Bot,
	Layers,
	Keyboard,
	Cloud,
	Code2,
	FileCode,
	Folder,
	Folders,
	HeartPulse,
	Settings,
	Library,
	ListChecks,
	MessageCircle,
	PenLine,
	Boxes,
	Plug,
	PlugZap,
	ServerCog,
	ShieldCheck,
	Sparkles,
	ToggleRight,
	UserRound,
	type LucideIcon,
	Globe,
} from 'lucide-react';
import { AGENTS, type AgentId } from '@/lib/compat';

export interface SettingsNavigationItem {
	readonly path: string;
	readonly labelKey: string;
	readonly sidebarLabelKey?: string;
	readonly descriptionKey: string;
	readonly icon: LucideIcon;
	readonly badge?: string;
	readonly comingSoon?: boolean;
}

export interface SettingsDetailItem {
	readonly path: string;
	readonly labelKey: string;
	readonly descriptionKey?: string;
	readonly keywords?: string;
	readonly icon?: LucideIcon;
	readonly targetId?: string;
}

export interface SettingsModelServiceItem {
	readonly id: AgentId;
	readonly path: string;
	readonly labelKey: string;
	readonly descriptionKey: string;
	readonly keywords: string;
	readonly icon: LucideIcon;
	readonly comingSoon?: boolean;
}

export const SETTINGS_MODEL_SERVICE_ITEMS: readonly SettingsModelServiceItem[] = [
	{
		id: AGENTS.assistant,
		path: '/settings/agent',
		labelKey: 'settings.modelServices.chatName',
		descriptionKey: 'settings.modelServices.kucedrDescription',
		keywords: 'kucedr service default provider model',
		icon: MessageCircle,
	},
] as const;

export interface SettingsProviderConfigItem {
	readonly path: string;
	readonly labelKey: string;
	readonly descriptionKey: string;
	readonly icon: LucideIcon;
	readonly comingSoon?: boolean;
}

export const SETTINGS_PROVIDER_CONFIG_ITEMS: readonly SettingsProviderConfigItem[] = [
	{
		path: '/settings/cloud',
		labelKey: 'settings.storage.configurationTitle',
		descriptionKey: 'settings.storage.description',
		icon: Folder,
	},
] as const;

export const SETTINGS_DETAIL_ITEMS: readonly SettingsDetailItem[] = [
	// General
	{
		path: '/settings/general',
		labelKey: 'settings.language.title',
		descriptionKey: 'settings.language.description',
		keywords: 'locale english italian i18n',
		targetId: 'settings-language',
	},
	{
		path: '/settings/general',
		labelKey: 'settings.application.menuBar',
		descriptionKey: 'settings.application.menuBarDescription',
		keywords: 'tray dock icon toggle',
		targetId: 'settings-menu-bar',
	},
	{
		path: '/settings/general',
		labelKey: 'settings.application.appData',
		descriptionKey: 'settings.application.appDataDescription',
		keywords: 'folder files storage',
		targetId: 'settings-app-data',
	},
	// Application
	{
		path: '/settings/general',
		labelKey: 'settings.theme.title',
		keywords: 'appearance dark light system mode',
		targetId: 'settings-theme',
	},
	{
		path: '/settings/general',
		labelKey: 'settings.theme.appearance',
		keywords: 'theme plugin appearance colors palette',
		targetId: 'settings-theme-appearance',
	},
	{
		path: '/settings/general',
		labelKey: 'settings.application.soundFeedback',
		descriptionKey: 'settings.application.soundFeedbackDescription',
		keywords: 'sound effects audio feedback',
		targetId: 'settings-sound',
	},
	{
		path: '/settings/general',
		labelKey: 'settings.application.runNotifications',
		descriptionKey: 'settings.application.runNotificationsDescription',
		keywords: 'notifications alerts finished runs background',
		targetId: 'settings-notifications',
	},
	{
		path: '/settings/general',
		labelKey: 'settings.application.interfaceSize.title',
		descriptionKey: 'settings.application.interfaceSize.description',
		keywords: 'zoom scale font text size bigger larger accessibility',
		targetId: 'settings-interface-size',
	},
	{
		path: '/settings/general',
		labelKey: 'settings.application.chatTextSize.title',
		descriptionKey: 'settings.application.chatTextSize.description',
		keywords: 'chat font text size readability',
		targetId: 'settings-chat-text-size',
	},
	{
		path: '/settings/browser/passwords',
		labelKey: 'settings.browser.passwordsPage.title',
		descriptionKey: 'settings.browser.passwordsPage.description',
		keywords: 'browser passwords logins saved edit delete',
	},
	{
		path: '/settings/browser/bookmarks',
		labelKey: 'settings.browser.bookmarksPage.title',
		descriptionKey: 'settings.browser.bookmarksPage.description',
		keywords: 'browser bookmarks favorites saved edit delete',
	},
	{
		path: '/settings/browser/history',
		labelKey: 'settings.browser.historyPage.title',
		descriptionKey: 'settings.browser.historyPage.description',
		keywords: 'browser history visited pages search delete clear',
	},
	{
		path: '/settings/general/persona',
		labelKey: 'settings.voiceAgent.title',
		descriptionKey: 'settings.voiceAgent.description',
		keywords: 'voice agent orb appearance idle listening thinking speaking',
	},
	// Media permissions
	{
		path: '/settings/general/media/microphone',
		labelKey: 'settings.system.media.microphone.label',
		descriptionKey: 'settings.microphone.systemPermissionDescription',
		keywords: 'microphone audio recorder permission activate disable',
	},
	{
		path: '/settings/general/media/camera',
		labelKey: 'settings.system.media.camera.label',
		descriptionKey: 'settings.camera.systemPermissionDescription',
		keywords: 'camera webcam video permission activate disable',
	},
	{
		path: '/settings/general/media/screen',
		labelKey: 'settings.application.accessibility',
		descriptionKey: 'settings.application.accessibilityDescription',
		keywords: 'permission system',
	},
	{
		path: '/settings/general',
		labelKey: 'settings.application.screenRecording',
		descriptionKey: 'settings.application.screenRecordingDescription',
		keywords: 'permission capture screen',
	},
	{
		path: '/settings/general',
		labelKey: 'settings.system.capabilities.title',
		descriptionKey: 'settings.system.capabilities.description',
		keywords:
			'windows files network webcam microphone audio bluetooth usb printer scanner clipboard notifications gps location system information drivers daemons hardware',
	},
	// Services
	{
		path: '/settings/cloud',
		labelKey: 'settings.searchEngine.engines',
		descriptionKey: 'settings.searchEngine.description',
		keywords: 'web search api key',
	},
	// Apps
	{
		path: '/settings/apps',
		labelKey: 'settings.apps.title',
		descriptionKey: 'settings.apps.description',
		keywords: 'external apps window manifest api install folder entry',
	},
	// Scripts
	{
		path: '/settings/scripts',
		labelKey: 'settings.scripts.title',
		descriptionKey: 'settings.scripts.description',
		keywords: 'plugin scripts render code fence',
	},
	// Modes
	{
		path: '/settings/modes',
		labelKey: 'settings.modes.title',
		descriptionKey: 'settings.modes.description',
		keywords: 'plugin modes commands plan goal slash',
	},
	// Skills
	{
		path: '/settings/skills',
		labelKey: 'settings.skills.title',
		keywords: 'plugins import folder delete refresh',
	},
	// Tools
	{
		path: '/settings/agent/tools',
		labelKey: 'settings.modelServices.tools',
		descriptionKey: 'settings.modelServices.toolsDescription',
		keywords: 'tools image audio video speech text to speech transcription search engine',
	},
	{
		path: '/settings/agent/mcp-tools',
		labelKey: 'settings.modelServices.agentTools.mcp.title',
		descriptionKey: 'settings.modelServices.agentTools.mcp.description',
		keywords: 'mcp tools servers permissions allow deny ask',
	},
	{
		path: '/settings/voice/tools',
		labelKey: 'settings.modelServices.tools',
		descriptionKey: 'settings.modelServices.toolsDescription',
		keywords: 'voice tools permissions allow deny ask',
	},
	{
		path: '/settings/tasks/tools',
		labelKey: 'settings.modelServices.tools',
		descriptionKey: 'settings.modelServices.toolsDescription',
		keywords: 'task scheduled tools permissions allow deny ask',
	},
	{
		path: '/settings/health/tools',
		labelKey: 'settings.modelServices.tools',
		descriptionKey: 'settings.modelServices.toolsDescription',
		keywords: 'health tools permissions allow deny ask',
	},
	// Services
	{
		path: '/settings/services',
		labelKey: 'settings.tabs.services',
		descriptionKey: 'settings.overview.descriptions.services',
		keywords: 'services web search provider api key',
	},
	// Tasks
	{
		path: '/settings/cloud',
		labelKey: 'settings.cron.runtime.title',
		descriptionKey: 'settings.cron.runtime.description',
		keywords: 'scheduled agent provider model runtime',
	},
	{
		path: '/settings/tasks/history',
		labelKey: 'settings.cron.history.pageTitle',
		descriptionKey: 'settings.cron.history.pageDescription',
		keywords: 'scheduled task history runs sessions',
	},
	{
		path: '/settings/cloud',
		labelKey: 'settings.cron.schedulesTitle',
		descriptionKey: 'settings.cron.schedulesDescription',
		keywords: 'cron schedule recurring task',
	},
	// Permissions
	{
		path: '/settings/agent/permissions',
		labelKey: 'settings.tabs.permissions',
		descriptionKey: 'settings.overview.descriptions.permissions',
		keywords:
			'permissions permission directory recursive tool write edit exec allow deny ask voice task scheduled health locations protected',
	},
	// Health
	{
		path: '/settings/health',
		labelKey: 'settings.health.settingsTitle',
		descriptionKey: 'settings.health.settingsDescription',
		keywords: 'periodic health check interval provider model',
	},
	// Model services
	...SETTINGS_MODEL_SERVICE_ITEMS,
	{
		path: '/settings/agent/chathistory',
		labelKey: 'settings.chatHistory.title',
		descriptionKey: 'settings.chatHistory.description',
		keywords: 'chat history transcript messages context delete clear folder',
		icon: Bot,
	},
	{
		path: '/settings/voice/history',
		labelKey: 'settings.modelServices.voiceHistoryTitle',
		descriptionKey: 'settings.modelServices.voiceHistoryDescription',
		keywords: 'voice conversation history transcript sessions',
	},
] as const;

export const SETTINGS_NAVIGATION: readonly SettingsNavigationItem[] = [
	{
		path: '/settings/models',
		labelKey: 'settings.tabs.models',
		descriptionKey: 'settings.overview.descriptions.models',
		icon: Boxes,
	},
	{
		path: '/settings/memory',
		labelKey: 'settings.memory.title',
		descriptionKey: 'settings.memory.description',
		icon: Brain,
	},
	{
		path: '/settings/account',
		labelKey: 'settings.tabs.account',
		descriptionKey: 'settings.overview.descriptions.account',
		icon: UserRound,
	},
	{
		path: '/settings/general',
		labelKey: 'settings.tabs.general',
		descriptionKey: 'settings.overview.descriptions.general',
		icon: Settings,
	},
	{
		path: '/settings/cloud',
		labelKey: 'settings.tabs.storage',
		descriptionKey: 'settings.overview.descriptions.storage',
		icon: Cloud,
	},
	{
		path: '/settings/library',
		labelKey: 'library.title',
		descriptionKey: 'settings.overview.descriptions.library',
		icon: Library,
	},
	{
		path: '/settings/browser',
		labelKey: 'settings.browser.title',
		descriptionKey: 'settings.browser.description',
		icon: Globe,
	},
	{
		path: '/settings/privacy',
		labelKey: 'settings.privacy.title',
		descriptionKey: 'settings.privacy.description',
		icon: ShieldCheck,
	},
	{
		path: '/settings/usage',
		labelKey: 'settings.usage.title',
		descriptionKey: 'settings.usage.description',
		icon: ChartNoAxesColumnIncreasing,
	},
	{
		path: '/workspace',
		labelKey: 'settings.workspace.title',
		descriptionKey: 'settings.workspace.description',
		icon: Folders,
	},
	{
		path: '/settings/code',
		labelKey: 'navigationBar.code',
		descriptionKey: 'settings.code.description',
		icon: Code2,
		comingSoon: true,
	},
	{
		path: '/settings/editor',
		labelKey: 'settings.editor.title',
		descriptionKey: 'settings.editor.description',
		icon: PenLine,
	},
	{
		path: '/settings/voice',
		labelKey: 'settings.tabs.voice',
		descriptionKey: 'settings.modelServices.realtimeConversationDescription',
		icon: AudioLines,
	},
	{
		path: '/settings/health',
		labelKey: 'settings.tabs.health',
		descriptionKey: 'settings.overview.descriptions.health',
		icon: HeartPulse,
	},
	{
		path: '/settings/tasks',
		labelKey: 'settings.tabs.taskScheduler',
		descriptionKey: 'settings.overview.descriptions.cron',
		icon: ListChecks,
	},
	{
		path: '/settings/mcp',
		labelKey: 'settings.tabs.mcp',
		sidebarLabelKey: 'settings.sidebar.mcp',
		descriptionKey: 'settings.overview.descriptions.mcp',
		icon: PlugZap,
	},
	{
		path: '/settings/knowledge',
		labelKey: 'settings.knowledge.title',
		descriptionKey: 'settings.overview.descriptions.knowledge',
		icon: BookOpenText,
	},
	{
		path: '/settings/skills',
		labelKey: 'settings.tabs.skills',
		descriptionKey: 'settings.overview.descriptions.skills',
		icon: Sparkles,
	},
	{
		path: '/settings/agent/permissions',
		labelKey: 'settings.tabs.permissions',
		descriptionKey: 'settings.overview.descriptions.permissions',
		icon: ShieldCheck,
	},
	{
		path: '/settings/plugins',
		labelKey: 'settings.tabs.plugins',
		descriptionKey: 'settings.overview.descriptions.integrations',
		icon: Plug,
	},
	{
		path: '/settings/apps',
		labelKey: 'settings.tabs.apps',
		descriptionKey: 'settings.overview.descriptions.apps',
		icon: Layers,
	},
	{
		path: '/settings/services',
		labelKey: 'settings.tabs.services',
		descriptionKey: 'settings.overview.descriptions.services',
		icon: ServerCog,
	},
	{
		path: '/settings/scripts',
		labelKey: 'settings.tabs.scripts',
		descriptionKey: 'settings.overview.descriptions.scripts',
		icon: FileCode,
	},
	{
		path: '/settings/modes',
		labelKey: 'settings.tabs.modes',
		descriptionKey: 'settings.overview.descriptions.modes',
		icon: ToggleRight,
	},
] satisfies readonly SettingsNavigationItem[];
