import path from 'node:path';
import Store from 'electron-store';
import type { AgentMediaModelSettings } from '../../shared/agent_types';
import {
	AGENT_PROFILE_MODEL_KEYS,
	AGENT_TOOL_PROFILE_IDS,
	type AgentProfileModelKey,
	type AgentToolConfiguration,
	type AgentToolProfile,
	type AgentToolProfileId,
	type AgentToolReference,
} from '../../shared/agent_tools';
import { userDataLocation } from '../shared/user_data_location';

type AgentProfileStore = {
	llm?: AgentMediaModelSettings;
	tts?: AgentMediaModelSettings;
	stt?: AgentMediaModelSettings;
	textToText: AgentMediaModelSettings;
	textToSpeech: AgentMediaModelSettings;
	speechToText: AgentMediaModelSettings;
	realtimeVoice: AgentMediaModelSettings;
	image: AgentMediaModelSettings;
	audio: AgentMediaModelSettings;
	video: AgentMediaModelSettings;
	tools: Record<string, AgentToolConfiguration>;
	mcpTools: Record<string, Record<string, AgentToolConfiguration>>;
};

const EMPTY_MODEL: AgentMediaModelSettings = { providerId: '', modelId: '', options: {} };
const DEFAULT_TOOL: AgentToolConfiguration = { enabled: true, permission: 'allow' };
const settingsDirectory = path.resolve(userDataLocation(), 'settings');
const SHARED_PROFILE_IDS = new Set<AgentToolProfileId>([
	'chat',
	'voice',
	'tasks',
	'health',
	'channels',
]);
const profileStoreName = (profileId: AgentToolProfileId): string =>
	SHARED_PROFILE_IDS.has(profileId) ? profileId : `${profileId}-agent`;
const PROFILE_MODEL_KEYS: Record<AgentToolProfileId, readonly AgentProfileModelKey[]> = {
	chat: ['textToText', 'textToSpeech', 'speechToText'],
	voice: ['realtimeVoice'],
	tasks: ['textToText'],
	health: ['textToText'],
	channels: ['textToText', 'textToSpeech', 'speechToText'],
};
const storedModelKey = (
	profileId: AgentToolProfileId,
	modelKey: AgentProfileModelKey
): keyof AgentProfileStore =>
	(profileId === 'tasks' || profileId === 'health') && modelKey === 'textToText'
		? 'llm'
		: (profileId === 'chat' || profileId === 'channels') && modelKey === 'textToText'
			? 'llm'
			: (profileId === 'chat' || profileId === 'channels') && modelKey === 'textToSpeech'
				? 'tts'
				: (profileId === 'chat' || profileId === 'channels') && modelKey === 'speechToText'
					? 'stt'
					: profileId === 'voice' && modelKey === 'realtimeVoice'
						? 'rtv'
						: modelKey;

const stores = Object.fromEntries(
	AGENT_TOOL_PROFILE_IDS.map((profileId) => [
		profileId,
		new Store<Partial<AgentProfileStore>>({
			name: profileStoreName(profileId),
			cwd: settingsDirectory,
			accessPropertiesByDotNotation: false,
		}),
	])
) as Record<AgentToolProfileId, Store<Partial<AgentProfileStore>>>;

function defaults(): AgentProfileStore {
	return {
		textToText: { ...EMPTY_MODEL },
		textToSpeech: { ...EMPTY_MODEL },
		speechToText: { ...EMPTY_MODEL },
		realtimeVoice: { ...EMPTY_MODEL },
		image: { ...EMPTY_MODEL },
		audio: { ...EMPTY_MODEL },
		video: { ...EMPTY_MODEL },
		tools: {},
		mcpTools: {},
	};
}

function profileStore(profileId: AgentToolProfileId): Store<Partial<AgentProfileStore>> {
	return stores[profileId];
}

function read(profileId: AgentToolProfileId): AgentProfileStore {
	const stored = profileStore(profileId).store;
	const fallback = defaults();
	return {
		...fallback,
		tools: { ...(stored.tools ?? {}) },
		mcpTools: structuredClone(stored.mcpTools ?? {}),
		...Object.fromEntries(
			AGENT_PROFILE_MODEL_KEYS.map((key) => [
				key,
				{
					...fallback[key],
					...(stored[storedModelKey(profileId, key)] ?? {}),
					options: { ...(stored[storedModelKey(profileId, key)]?.options ?? {}) },
				},
			])
		),
	};
}

function write(profileId: AgentToolProfileId, next: AgentProfileStore): void {
	const profile = {
		...Object.fromEntries(
			PROFILE_MODEL_KEYS[profileId].map((key) => [
				storedModelKey(profileId, key),
				{ ...EMPTY_MODEL, ...next[key], options: { ...next[key].options } },
			])
		),
		tools: { ...next.tools },
		mcpTools: structuredClone(next.mcpTools),
	} as AgentProfileStore;
	const existing = profileStore(profileId).store;
	const legacyKeys =
		profileId === 'channels'
			? [
					'llmProviderId',
					'llmModelId',
					'sttProviderId',
					'sttModelId',
					'ttsProviderId',
					'ttsModelId',
				]
			: ['providerId', 'modelId', 'modelOptions'];
	const profileKeys = [
		'llm',
		'tts',
		'stt',
		'rtv',
		...AGENT_PROFILE_MODEL_KEYS,
		'tools',
		'mcpTools',
	];
	const preserved = SHARED_PROFILE_IDS.has(profileId)
		? Object.fromEntries(
				Object.entries(existing).filter(
					([key]) => ![...legacyKeys, ...profileKeys, 'schemaVersion', 'migrations'].includes(key)
				)
			)
		: {};
	profileStore(profileId).store = { ...preserved, ...profile };
}

for (const profileId of AGENT_TOOL_PROFILE_IDS) write(profileId, read(profileId));

export function getAgentProfileDocument(profileId: AgentToolProfileId): Record<string, unknown> {
	return structuredClone(profileStore(profileId).store);
}

export function setAgentProfileDocument(
	profileId: AgentToolProfileId,
	document: Record<string, unknown>
): void {
	const { schemaVersion: _schemaVersion, migrations: _migrations, ...next } = document;
	profileStore(profileId).store = next as Partial<AgentProfileStore>;
}

export function getAgentProfileModel(
	profileId: AgentToolProfileId,
	modelKey: AgentProfileModelKey
): AgentMediaModelSettings {
	return structuredClone(read(profileId)[modelKey]);
}

export function setAgentProfileModel(
	profileId: AgentToolProfileId,
	modelKey: AgentProfileModelKey,
	settings: AgentMediaModelSettings
): AgentMediaModelSettings {
	if (!PROFILE_MODEL_KEYS[profileId].includes(modelKey)) {
		throw new Error(`Unsupported ${modelKey} model for ${profileId}.`);
	}
	const current = read(profileId);
	const next = {
		providerId: settings.providerId.trim(),
		modelId: settings.modelId.trim(),
		options: { ...settings.options },
	};
	write(profileId, { ...current, [modelKey]: next });
	return structuredClone(next);
}

export function getAgentProfileTools(profileId: AgentToolProfileId): AgentToolProfile {
	const profile = read(profileId);
	return { tools: { ...profile.tools }, mcp: structuredClone(profile.mcpTools) };
}

export function setAgentProfileTool(
	profileId: AgentToolProfileId,
	tool: AgentToolReference,
	settings: AgentToolConfiguration
): AgentToolProfile {
	const current = read(profileId);
	if (tool.kind === 'builtin') {
		current.tools[tool.id] = { ...settings };
	} else {
		current.mcpTools[tool.serverId] = {
			...current.mcpTools[tool.serverId],
			[tool.toolName]: { ...settings },
		};
	}
	write(profileId, current);
	return getAgentProfileTools(profileId);
}

export function getAgentProfileTool(
	profileId: AgentToolProfileId,
	tool: AgentToolReference
): AgentToolConfiguration {
	const profile = read(profileId);
	return tool.kind === 'builtin'
		? (profile.tools[tool.id] ?? DEFAULT_TOOL)
		: (profile.mcpTools[tool.serverId]?.[tool.toolName] ?? DEFAULT_TOOL);
}

export function agentProfileStorePath(profileId: AgentToolProfileId): string {
	return profileStore(profileId).path;
}
