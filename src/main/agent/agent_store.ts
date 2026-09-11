import path from 'node:path';
import Store from 'electron-store';
import type {
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
	type PermissionsSchema,
} from './permissions/permissions_types';
import { withWorkspacePermissions } from './permissions/with_workspace_permissions';

export type SearchEngineSettings = {
	providerId: string;
	providerName: string;
	enabled: boolean;
};
type AgentStoreSchema = {
	chatbot: {
		textToText: AgentMediaModelSettings;
	};
	voice: {
		textToSpeech: AgentMediaModelSettings;
		realtimeVoice: AgentMediaModelSettings;
		speechToText: AgentMediaModelSettings;
	};
	tools: {
		webSearch: SearchEngineSettings;
		image: AgentMediaModelSettings;
		audio: AgentMediaModelSettings;
		video: AgentMediaModelSettings;
		textToSpeech: AgentMediaModelSettings;
		speechToText: AgentMediaModelSettings;
	};
	permissions: PermissionsSchema;
};

type LegacyAgentStoreSchema = Partial<Omit<AgentStoreSchema, 'chatbot' | 'voice'>> & {
	chatbot?: {
		model?: AgentMediaModelSettings;
		voice?: AgentMediaModelSettings;
		realtimeVoice?: AgentMediaModelSettings;
		transcription?: AgentMediaModelSettings;
		textToText?: AgentMediaModelSettings;
	};
	voice?: Partial<AgentStoreSchema['voice']>;
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
const DEFAULT_AGENT_STORE: AgentStoreSchema = {
	chatbot: {
		textToText: EMPTY_MEDIA_MODEL,
	},
	voice: {
		textToSpeech: EMPTY_MEDIA_MODEL,
		realtimeVoice: EMPTY_MEDIA_MODEL,
		speechToText: EMPTY_MEDIA_MODEL,
	},
	tools: {
		webSearch: { providerId: '', providerName: '', enabled: false },
		image: EMPTY_MEDIA_MODEL,
		audio: EMPTY_MEDIA_MODEL,
		video: EMPTY_MEDIA_MODEL,
		textToSpeech: EMPTY_MEDIA_MODEL,
		speechToText: EMPTY_MEDIA_MODEL,
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
	},
	voice: {
		textToSpeech:
			persisted.voice?.textToSpeech ??
			persisted.chatbot?.voice ??
			persisted.text_to_speech_model ??
			persisted.voice_model ??
			EMPTY_MEDIA_MODEL,
		realtimeVoice:
			persisted.voice?.realtimeVoice ??
			persisted.chatbot?.realtimeVoice ??
			persisted.realtime_voice_model ??
			EMPTY_MEDIA_MODEL,
		speechToText:
			persisted.voice?.speechToText ??
			persisted.chatbot?.transcription ??
			persisted.transcription_model ??
			EMPTY_MEDIA_MODEL,
	},
	tools: {
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
	},
	permissions: persisted.permissions ?? DEFAULT_AGENT_PERMISSIONS,
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

export function getSearchEngine(): SearchEngineSettings {
	return store.get('tools').webSearch;
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
	return store.get('tools')[kind];
}

export function setToolModel(kind: AgentToolModelKind, settings: AgentMediaModelSettings): void {
	store.set('tools', { ...store.get('tools'), [kind]: settings });
}

export function getPermissions(): PermissionsSchema {
	return withWorkspacePermissions(
		normalizePermissionsSchema(store.get('permissions'), DEFAULT_AGENT_PERMISSIONS),
		workspacePattern
	);
}

export function setPermissions(permissions: PermissionsSchema): PermissionsSchema {
	store.set(
		'permissions',
		withWorkspacePermissions(
			normalizePermissionsSchema(permissions, DEFAULT_AGENT_PERMISSIONS),
			workspacePattern
		)
	);
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
	return getPermissions();
}
