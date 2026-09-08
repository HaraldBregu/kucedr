import {
	Binary,
	BookOpenText,
	Bot,
	Layers,
	BotMessageSquare,
	Cloud,
	Code2,
	Database,
	Folder,
	HeartPulse,
	ImageIcon,
	Info,
	Library,
	ListChecks,
	Mic,
	MonitorCog,
	Music,
	PlugZap,
	RadioTower,
	Search,
	Server,
	ShieldCheck,
	Sparkles,
	Video,
	Volume2,
	UserRound,
	type LucideIcon,
} from 'lucide-react';
import { AGENTS, type AgentId } from '@/lib/compat';

export interface SettingsNavigationItem {
	readonly path: string;
	readonly labelKey: string;
	readonly descriptionKey: string;
	readonly icon: LucideIcon;
	readonly comingSoon?: boolean;
}

export interface SettingsDetailItem {
	readonly path: string;
	readonly labelKey: string;
	readonly descriptionKey?: string;
	readonly keywords?: string;
	readonly icon?: LucideIcon;
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
		labelKey: 'settings.modelServices.assistantName',
		descriptionKey: 'settings.modelServices.kucedrDescription',
		keywords: 'kucedr service default provider model',
		icon: Bot,
	},
	{
		id: AGENTS.coder,
		path: '/settings/coder',
		labelKey: 'settings.coder.title',
		descriptionKey: 'settings.coder.description',
		keywords: 'coder coding pi codex anthropic claude openai agent harness runtime',
		icon: Code2,
	},
	{
		id: AGENTS.speechToText,
		path: '/settings/providers/transcribe',
		labelKey: 'settings.modelServices.speechTranscriberName',
		descriptionKey: 'settings.modelServices.speechTranscriberDescription',
		keywords: 'speech transcription transcribe audio voice microphone model',
		icon: Mic,
	},
	{
		id: AGENTS.textToSpeech,
		path: '/settings/providers/voice',
		labelKey: 'settings.modelServices.voiceName',
		descriptionKey: 'settings.modelServices.voiceDescription',
		keywords: 'voice text to speech tts output speaking audio synthesis model',
		icon: Volume2,
	},
	{
		id: AGENTS.textToImage,
		path: '/settings/providers/image',
		labelKey: 'settings.modelServices.imageAssistantName',
		descriptionKey: 'settings.modelServices.imageAssistantDescription',
		keywords: 'image generation prompt creative model',
		icon: ImageIcon,
	},
	{
		id: AGENTS.embedding,
		path: '/settings/providers/embedding',
		labelKey: 'settings.modelServices.embeddingName',
		descriptionKey: 'settings.modelServices.embeddingDescription',
		keywords: 'embedding embeddings vector rag retrieval search index model',
		icon: Binary,
	},
	{
		id: AGENTS.textToVideo,
		path: '/settings/providers/video',
		labelKey: 'settings.modelServices.videoCreatorName',
		descriptionKey: 'settings.modelServices.videoCreatorDescription',
		keywords: 'text to video generation model',
		icon: Video,
	},
	{
		id: AGENTS.textToAudio,
		path: '/settings/providers/music',
		labelKey: 'settings.modelServices.musicCreatorName',
		descriptionKey: 'settings.modelServices.musicCreatorDescription',
		keywords: 'music audio generation creator model',
		icon: Music,
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
	{
		path: '/settings/channels',
		labelKey: 'settings.tabs.channels',
		descriptionKey: 'settings.overview.descriptions.channels',
		icon: RadioTower,
	},
] as const;

export const SETTINGS_DETAIL_ITEMS: readonly SettingsDetailItem[] = [
	// General
	{
		path: '/settings/general',
		labelKey: 'settings.language.title',
		descriptionKey: 'settings.language.description',
		keywords: 'locale english italian i18n',
	},
	{
		path: '/settings/general',
		labelKey: 'settings.application.menuBar',
		descriptionKey: 'settings.application.menuBarDescription',
		keywords: 'tray dock icon toggle',
	},
	{
		path: '/settings/general',
		labelKey: 'settings.application.appData',
		descriptionKey: 'settings.application.appDataDescription',
		keywords: 'folder files storage',
	},
	// Application
	{
		path: '/settings/general',
		labelKey: 'settings.theme.title',
		keywords: 'appearance dark light system mode',
	},
	{
		path: '/settings/general/persona',
		labelKey: 'settings.persona.title',
		descriptionKey: 'settings.persona.description',
		keywords: 'persona voice orb appearance idle listening thinking speaking',
	},
	// System — permissions
	{
		path: '/settings/system',
		labelKey: 'settings.microphone.title',
		descriptionKey: 'settings.microphone.systemPermissionDescription',
		keywords: 'microphone audio recorder permission activate disable',
	},
	{
		path: '/settings/system',
		labelKey: 'settings.camera.title',
		descriptionKey: 'settings.camera.systemPermissionDescription',
		keywords: 'camera webcam video permission activate disable',
	},
	{
		path: '/settings/system',
		labelKey: 'settings.application.accessibility',
		descriptionKey: 'settings.application.accessibilityDescription',
		keywords: 'permission system',
	},
	{
		path: '/settings/system',
		labelKey: 'settings.application.screenRecording',
		descriptionKey: 'settings.application.screenRecordingDescription',
		keywords: 'permission capture screen',
	},
	{
		path: '/settings/system',
		labelKey: 'settings.system.capabilities.title',
		descriptionKey: 'settings.system.capabilities.description',
		keywords:
			'windows files network webcam microphone audio bluetooth usb printer scanner clipboard notifications gps location system information drivers daemons hardware',
	},
	// Providers — API keys
	{
		path: '/settings/providers/keys',
		labelKey: 'settings.providers.modelsApiKeys',
		descriptionKey: 'settings.providers.storeApiKeysDescription',
		keywords: 'api key secret token anthropic openai google provider',
		icon: Server,
	},
	// Search engines
	{
		path: '/settings/cloud',
		labelKey: 'settings.searchEngine.braveName',
		descriptionKey: 'settings.searchEngine.braveDescription',
		keywords: 'brave web search api key',
	},
	{
		path: '/settings/cloud',
		labelKey: 'settings.searchEngine.tavilyName',
		descriptionKey: 'settings.searchEngine.tavilyDescription',
		keywords: 'tavily web search api key',
	},
	// Apps
	{
		path: '/settings/apps',
		labelKey: 'settings.apps.title',
		descriptionKey: 'settings.apps.description',
		keywords: 'external apps window manifest api install folder entry',
	},
	// Channels
	{
		path: '/settings/channels',
		labelKey: 'settings.channels.enabled',
		descriptionKey: 'settings.channels.enabledDescription',
		keywords: 'toggle on off activate',
	},
	{
		path: '/settings/channels',
		labelKey: 'settings.channels.token',
		descriptionKey: 'settings.channels.tokenDescription',
		keywords: 'bot secret key telegram discord',
	},
	{
		path: '/settings/channels',
		labelKey: 'settings.channels.dmPolicy',
		descriptionKey: 'settings.channels.dmPolicyDescription',
		keywords: 'allowlist open pairing deny direct message',
	},
	{
		path: '/settings/channels',
		labelKey: 'settings.channels.allowFrom',
		descriptionKey: 'settings.channels.allowFromDescription',
		keywords: 'whitelist users allowed senders',
	},
	{
		path: '/settings/channels',
		labelKey: 'settings.channels.status',
		keywords: 'connected disconnected runtime start stop',
	},
	// Skills
	{
		path: '/settings/agent/skills',
		labelKey: 'settings.skills.title',
		keywords: 'plugins import folder delete refresh',
	},
	// Tasks
	{
		path: '/settings/cloud',
		labelKey: 'settings.cron.runtime.title',
		descriptionKey: 'settings.cron.runtime.description',
		keywords: 'scheduled agent provider model runtime',
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
		labelKey: 'settings.permissions.toolsTitle',
		descriptionKey: 'settings.permissions.toolsDescription',
		keywords: 'permissions permission directory recursive tool write edit exec allow deny ask',
	},
	// Health
	{
		path: '/settings/agent/health',
		labelKey: 'settings.health.settingsTitle',
		descriptionKey: 'settings.health.settingsDescription',
		keywords: 'periodic health check interval provider model',
	},
	{
		path: '/settings/agent/health',
		labelKey: 'settings.health.checklistTitle',
		descriptionKey: 'settings.health.checklistDescription',
		keywords: 'health checklist instructions agent HEALTH.md',
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
		path: '/settings/agent/data',
		labelKey: 'settings.dataControls.title',
		descriptionKey: 'settings.dataControls.description',
		keywords: 'data management export purge memory sessions local knowledge index',
		icon: Database,
	},
] as const;

export const SETTINGS_NAVIGATION: readonly SettingsNavigationItem[] = [
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
		icon: Info,
	},
	{
		path: '/settings/system',
		labelKey: 'settings.tabs.system',
		descriptionKey: 'settings.overview.descriptions.system',
		icon: MonitorCog,
	},
	{
		path: '/settings/cloud',
		labelKey: 'settings.tabs.cloud',
		descriptionKey: 'settings.overview.descriptions.cloud',
		icon: Cloud,
	},
	{
		path: '/settings/agent/tasks',
		labelKey: 'settings.tabs.taskScheduler',
		descriptionKey: 'settings.overview.descriptions.cron',
		icon: ListChecks,
	},
	{
		path: '/settings/providers/models',
		labelKey: 'settings.overview.groups.mlModels',
		descriptionKey: 'settings.overview.descriptions.providers',
		icon: Server,
	},
	{
		path: '/settings/providers/search',
		labelKey: 'settings.tabs.searchEngines',
		descriptionKey: 'settings.overview.descriptions.searchEngine',
		icon: Search,
	},
	{
		path: '/settings/agent/mcp',
		labelKey: 'settings.tabs.mcp',
		descriptionKey: 'settings.overview.descriptions.mcp',
		icon: PlugZap,
	},
	{
		path: '/settings/agent/rag',
		labelKey: 'settings.rag.title',
		descriptionKey: 'settings.overview.descriptions.rag',
		icon: Library,
	},
	{
		path: '/settings/agent/llm-wiki',
		labelKey: 'settings.wiki.title',
		descriptionKey: 'settings.overview.descriptions.wiki',
		icon: BookOpenText,
	},
	{
		path: '/settings/agent/skills',
		labelKey: 'settings.tabs.skills',
		descriptionKey: 'settings.overview.descriptions.skills',
		icon: Sparkles,
	},
	{
		path: '/settings/agent/health',
		labelKey: 'settings.tabs.health',
		descriptionKey: 'settings.overview.descriptions.health',
		icon: HeartPulse,
	},
	{
		path: '/settings/agent/permissions',
		labelKey: 'settings.tabs.permissions',
		descriptionKey: 'settings.overview.descriptions.permissions',
		icon: ShieldCheck,
	},
	{
		path: '/settings/channels',
		labelKey: 'settings.tabs.channels',
		descriptionKey: 'settings.overview.descriptions.channels',
		icon: RadioTower,
	},
	{
		path: '/settings/a2a',
		labelKey: 'settings.tabs.a2a',
		descriptionKey: 'settings.overview.descriptions.a2a',
		icon: BotMessageSquare,
	},
	{
		path: '/settings/apps',
		labelKey: 'settings.tabs.apps',
		descriptionKey: 'settings.overview.descriptions.apps',
		icon: Layers,
	},
] satisfies readonly SettingsNavigationItem[];

export const SETTINGS_AGENT_RESOURCE_ITEMS = [
	'/settings/agent/skills',
	'/settings/agent/tasks',
	'/settings/agent/mcp',
].flatMap((path) => SETTINGS_NAVIGATION.filter((item) => item.path === path));
