import path from 'node:path';
import Store from 'electron-store';
import type {
	AgentChatbotModelKind,
	AgentMediaModelSettings,
	AgentToolModelKind,
	AgentVoiceModelKind,
} from '../../shared/agent_types';
import { agentLocation } from '../shared/agent_location';
import { userDataLocation } from '../shared/user_data_location';
import { normalizePermissionsSchema } from './permissions/normalize_permissions_schema';
import {
	type PermissionBucket,
	type PermissionKind,
	type PermissionMode,
	type PermissionsSchema,
	type ToolConfiguration,
} from './permissions/permissions_types';
import { withWorkspacePermissions } from './permissions/with_workspace_permissions';

export type SearchEngineSettings = {
	providerId: string;
	providerName: string;
	enabled: boolean;
};
type ToolPermissions = Record<string, PermissionMode>;
type ToolSettings = ToolConfiguration;
type AgentToolsStore = {
	webSearch: SearchEngineSettings;
	image: AgentMediaModelSettings;
	audio: AgentMediaModelSettings;
	video: AgentMediaModelSettings;
	textToSpeech: AgentMediaModelSettings;
	speechToText: AgentMediaModelSettings;
	[key: string]: SearchEngineSettings | AgentMediaModelSettings | ToolSettings;
};
type AgentStoreSchema = {
	chatbot: {
		textToText: AgentMediaModelSettings;
		textToSpeech: AgentMediaModelSettings;
		speechToText: AgentMediaModelSettings;
	};
	voice: {
		realtimeVoice: AgentMediaModelSettings;
	};
	tools: AgentToolsStore;
	permissions: PermissionsSchema;
};

type LegacyAgentStoreSchema = Partial<Omit<AgentStoreSchema, 'chatbot' | 'voice'>> & {
	tools?: Partial<AgentToolsStore> & { permissions?: ToolPermissions };
	chatbot?: {
		model?: AgentMediaModelSettings;
		voice?: AgentMediaModelSettings;
		realtimeVoice?: AgentMediaModelSettings;
		transcription?: AgentMediaModelSettings;
		textToText?: AgentMediaModelSettings;
		textToSpeech?: AgentMediaModelSettings;
		speechToText?: AgentMediaModelSettings;
	};
	voice?: {
		textToSpeech?: AgentMediaModelSettings;
		realtimeVoice?: AgentMediaModelSettings;
		speechToText?: AgentMediaModelSettings;
	};
	large_language_model?: AgentMediaModelSettings;
	web_search_engine?: SearchEngineSettings;
	image_generator_model?: AgentMediaModelSettings;
	audio_generator_model?: AgentMediaModelSettings;
	video_generator_model?: AgentMediaModelSettings;
	text_to_speech_model?: AgentMediaModelSettings;
	realtime_voice_model?: AgentMediaModelSettings;
	transcription_model?: AgentMediaModelSettings;
	providerId?: string;
	modelId?: string;
	modelOptions?: Record<string, unknown>;
	search_engine?: SearchEngineSettings;
	image_model?: AgentMediaModelSettings;
	audio_model?: AgentMediaModelSettings;
	video_model?: AgentMediaModelSettings;
	voice_model?: AgentMediaModelSettings;
};

const AGENT_STORE_NAME = 'agent';
const settingsDirectory = path.resolve(userDataLocation(), 'settings');
export const AGENT_DIRECTORY = path.resolve(agentLocation());
const workspacePattern = `${AGENT_DIRECTORY.replaceAll(path.sep, '/')}/**`;
const DEFAULT_AGENT_PERMISSIONS: PermissionsSchema = {
	read: { allow: [workspacePattern], deny: [] },
	write: { allow: [workspacePattern], deny: [] },
	exec: { allow: [workspacePattern], deny: [] },
};
const EMPTY_MEDIA_MODEL: AgentMediaModelSettings = {
	providerId: '',
	modelId: '',
	options: {},
};
const RUNTIME_TOOL_KEYS = {
	list_a2a_agents: 'list_remote_agents',
	delegate_a2a: 'delegate_to_remote_agent',
	get_a2a_task: 'get_remote_task',
	cancel_a2a_task: 'cancel_remote_task',
	subagent: 'subagent',
	subagents: 'subagents',
	read: 'read_file',
	write: 'write_file',
	edit: 'edit_file',
	patch: 'apply_patch',
	undo: 'undo_file_operation',
	redo: 'redo_file_operation',
	bash: 'execute_command',
	process: 'manage_process',
	search_web: 'search_web',
	fetch_web_page: 'fetch_web_page',
	use_web_browser: 'use_web_browser',
	create_image: 'create_image',
	create_video: 'create_video',
	create_sound: 'create_sound',
	text_to_speech: 'text_to_speech',
	speech_to_text: 'speech_to_text',
	microphone_recorder: 'microphone_recorder',
	microphone_recorder_status: 'microphone_recorder_status',
	microphone_recorder_stop: 'microphone_recorder_stop',
	camera_recorder: 'camera_recorder',
	camera_recorder_status: 'camera_recorder_status',
	camera_recorder_stop: 'camera_recorder_stop',
	screen_recorder: 'screen_recorder',
	select_screen_source: 'select_screen_source',
	screen_recorder_status: 'screen_recorder_status',
	screen_recorder_stop: 'screen_recorder_stop',
	query_knowledge: 'query_knowledge',
	save_memory: 'save_memory',
	forget_memory: 'forget_memory',
	list_memories: 'list_memories',
	create_task: 'create_task',
	update_task: 'update_task',
	pause_task: 'pause_task',
	resume_task: 'resume_task',
	delete_task: 'delete_task',
	get_task: 'get_task',
	list_tasks: 'list_tasks',
	run_task_now: 'run_task_now',
	list_apps: 'list_apps',
	open_apps: 'open_apps',
	close_apps: 'close_apps',
	list_skills: 'list_skills',
	load_skill: 'load_skill',
	get_goal: 'get_goal',
	update_goal_plan: 'update_goal_plan',
	record_goal_evidence: 'record_goal_evidence',
	request_goal_completion: 'request_goal_completion',
	report_goal_blocker: 'report_goal_blocker',
	ask: 'request_user_input',
	update_health: 'update_health',
	update_health_settings: 'update_health_settings',
	complete_bootstrap: 'complete_bootstrap',
} as const;
const DEFAULT_RUNTIME_TOOL_SETTINGS: Record<string, ToolSettings> = Object.fromEntries(
	Object.values(RUNTIME_TOOL_KEYS).map((key) => [key, { enabled: true, permission: 'ask' }])
);
const DEFAULT_AGENT_STORE: AgentStoreSchema = {
	chatbot: {
		textToText: EMPTY_MEDIA_MODEL,
		textToSpeech: EMPTY_MEDIA_MODEL,
		speechToText: EMPTY_MEDIA_MODEL,
	},
	voice: {
		realtimeVoice: EMPTY_MEDIA_MODEL,
	},
	tools: {
		webSearch: { providerId: '', providerName: '', enabled: false },
		image: EMPTY_MEDIA_MODEL,
		audio: EMPTY_MEDIA_MODEL,
		video: EMPTY_MEDIA_MODEL,
		textToSpeech: EMPTY_MEDIA_MODEL,
		speechToText: EMPTY_MEDIA_MODEL,
		...DEFAULT_RUNTIME_TOOL_SETTINGS,
	},
	permissions: DEFAULT_AGENT_PERMISSIONS,
};

const store = new Store<AgentStoreSchema>({
	name: AGENT_STORE_NAME,
	cwd: settingsDirectory,
	accessPropertiesByDotNotation: false,
	defaults: DEFAULT_AGENT_STORE,
});

const persisted = { ...store.store } as LegacyAgentStoreSchema;
const { tools: legacyToolPermissions, ...persistedPermissions } =
	persisted.permissions ?? DEFAULT_AGENT_PERMISSIONS;
const isToolSettings = (value: unknown): value is ToolSettings =>
	!!value &&
	typeof value === 'object' &&
	typeof (value as ToolSettings).enabled === 'boolean' &&
	(['ask', 'allow', 'deny'] as const).includes((value as ToolSettings).permission);
const chatbotTextToText =
	persisted.chatbot?.textToText?.providerId || persisted.chatbot?.textToText?.modelId
		? persisted.chatbot.textToText
		: persisted.chatbot?.model?.providerId || persisted.chatbot?.model?.modelId
			? persisted.chatbot.model
			: persisted.large_language_model?.providerId || persisted.large_language_model?.modelId
				? persisted.large_language_model
				: {
						providerId: persisted.providerId ?? '',
						modelId: persisted.modelId ?? '',
						options: persisted.modelOptions ?? {},
					};
store.store = {
	chatbot: {
		textToText: chatbotTextToText,
		textToSpeech:
			persisted.chatbot?.textToSpeech ??
			persisted.voice?.textToSpeech ??
			persisted.chatbot?.voice ??
			persisted.text_to_speech_model ??
			persisted.voice_model ??
			EMPTY_MEDIA_MODEL,
		speechToText:
			persisted.chatbot?.speechToText ??
			persisted.voice?.speechToText ??
			persisted.chatbot?.transcription ??
			persisted.transcription_model ??
			EMPTY_MEDIA_MODEL,
	},
	voice: {
		realtimeVoice:
			persisted.voice?.realtimeVoice ??
			persisted.chatbot?.realtimeVoice ??
			persisted.realtime_voice_model ??
			EMPTY_MEDIA_MODEL,
	},
	tools: {
		...DEFAULT_RUNTIME_TOOL_SETTINGS,
		webSearch:
			persisted.tools?.webSearch ??
			persisted.web_search_engine ??
			persisted.search_engine ??
			DEFAULT_AGENT_STORE.tools.webSearch,
		image:
			persisted.tools?.image ??
			persisted.image_generator_model ??
			persisted.image_model ??
			EMPTY_MEDIA_MODEL,
		audio:
			persisted.tools?.audio ??
			persisted.audio_generator_model ??
			persisted.audio_model ??
			EMPTY_MEDIA_MODEL,
		video:
			persisted.tools?.video ??
			persisted.video_generator_model ??
			persisted.video_model ??
			EMPTY_MEDIA_MODEL,
		textToSpeech: persisted.tools?.textToSpeech ?? EMPTY_MEDIA_MODEL,
		speechToText: persisted.tools?.speechToText ?? EMPTY_MEDIA_MODEL,
		...Object.fromEntries(
			Object.entries(RUNTIME_TOOL_KEYS).map(([toolId, key]) => [
				key,
				isToolSettings(persisted.tools?.[key])
					? persisted.tools[key]
					: { enabled: true, permission: legacyToolPermissions?.[toolId] ?? 'ask' },
			])
		),
	},
	permissions: persistedPermissions,
};

export function getProviderId(): string | undefined {
	return store.get('chatbot').textToText.providerId || undefined;
}

export function setProviderId(providerId: string): void {
	store.set('chatbot', {
		...store.get('chatbot'),
		textToText: { ...store.get('chatbot').textToText, providerId },
	});
}

export function getModelId(): string | undefined {
	return store.get('chatbot').textToText.modelId || undefined;
}

export function setModelId(modelId: string): void {
	store.set('chatbot', {
		...store.get('chatbot'),
		textToText: { ...store.get('chatbot').textToText, modelId },
	});
}

export function getModelOptions(): Record<string, unknown> {
	return store.get('chatbot').textToText.options;
}

export function setModelOptions(modelOptions: Record<string, unknown>): void {
	store.set('chatbot', {
		...store.get('chatbot'),
		textToText: { ...store.get('chatbot').textToText, options: modelOptions },
	});
}

export function getChatbotModel(kind: AgentChatbotModelKind): AgentMediaModelSettings {
	return store.get('chatbot')[kind];
}

export function setChatbotModel(
	kind: AgentChatbotModelKind,
	settings: AgentMediaModelSettings
): void {
	store.set('chatbot', { ...store.get('chatbot'), [kind]: settings });
}

export function getSearchEngine(): SearchEngineSettings {
	return store.get('tools').webSearch as SearchEngineSettings;
}

export function setSearchEngine(searchEngine: SearchEngineSettings): void {
	store.set('tools', { ...store.get('tools'), webSearch: searchEngine });
}

export function getVoiceModel(kind: AgentVoiceModelKind): AgentMediaModelSettings {
	return store.get('voice')[kind];
}

export function setVoiceModel(kind: AgentVoiceModelKind, settings: AgentMediaModelSettings): void {
	store.set('voice', { ...store.get('voice'), [kind]: settings });
}

export function getToolModel(kind: AgentToolModelKind): AgentMediaModelSettings {
	return store.get('tools')[kind] as AgentMediaModelSettings;
}

export function setToolModel(kind: AgentToolModelKind, settings: AgentMediaModelSettings): void {
	store.set('tools', { ...store.get('tools'), [kind]: settings });
}

export function getPermissions(): PermissionsSchema {
	const permissions = withWorkspacePermissions(
		normalizePermissionsSchema(store.get('permissions'), DEFAULT_AGENT_PERMISSIONS),
		workspacePattern
	);
	const tools = store.get('tools');
	return {
		...permissions,
		tools: Object.fromEntries(
			Object.entries(RUNTIME_TOOL_KEYS).map(([toolId, key]) => {
				const settings = tools[key] as ToolSettings;
				return [toolId, { ...settings }];
			})
		),
	};
}

export function setPermissions(permissions: PermissionsSchema): PermissionsSchema {
	const { tools, ...directoryPermissions } = permissions;
	store.set(
		'permissions',
		withWorkspacePermissions(
			normalizePermissionsSchema(directoryPermissions, DEFAULT_AGENT_PERMISSIONS),
			workspacePattern
		)
	);
	if (tools) {
		const storedTools = store.get('tools');
		store.set('tools', {
			...storedTools,
			...Object.fromEntries(
				Object.entries(RUNTIME_TOOL_KEYS).map(([toolId, key]) => [
					key,
					{
						...(storedTools[key] as ToolSettings),
						...(tools[toolId] ?? (storedTools[key] as ToolSettings)),
					},
				])
			),
		});
	}
	return getPermissions();
}

export function addPermissionRule(
	kind: PermissionKind,
	bucket: PermissionBucket,
	rule: string
): void {
	const permissions = getPermissions();
	const permission = permissions[kind];
	if (permission[bucket].includes(rule)) return;
	setPermissions({
		...permissions,
		[kind]: { ...permission, [bucket]: [...permission[bucket], rule] },
	});
}

export function resetPermissions(): PermissionsSchema {
	store.set('permissions', DEFAULT_AGENT_PERMISSIONS);
	store.set('tools', { ...store.get('tools'), ...DEFAULT_RUNTIME_TOOL_SETTINGS });
	return getPermissions();
}
