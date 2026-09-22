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
const SHARED_PROFILE_IDS = new Set<AgentToolProfileId>(['tasks', 'health']);
const profileStoreName = (profileId: AgentToolProfileId): string =>
	SHARED_PROFILE_IDS.has(profileId) ? profileId : `${profileId}-agent`;

	const stores = Object.fromEntries(
	AGENT_TOOL_PROFILE_IDS.filter((profileId) => !SHARED_PROFILE_IDS.has(profileId)).map(
		(profileId) => [
		profileId,
		new Store<Partial<AgentProfileStore>>({
			name: profileStoreName(profileId),
			cwd: settingsDirectory,
			accessPropertiesByDotNotation: false,
		}),
	]
	)
) as Partial<Record<AgentToolProfileId, Store<Partial<AgentProfileStore>>>>;

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
	const existing = stores[profileId];
	if (existing) return existing;
	return new Store<Partial<AgentProfileStore>>({
		name: profileStoreName(profileId),
		cwd: settingsDirectory,
		accessPropertiesByDotNotation: false,
	});
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
				{ ...fallback[key], ...(stored[key] ?? {}), options: { ...(stored[key]?.options ?? {}) } },
			])
		),
	};
}

function write(profileId: AgentToolProfileId, next: AgentProfileStore): void {
	const profile = {
		...Object.fromEntries(
			AGENT_PROFILE_MODEL_KEYS.map((key) => [
				key,
				{ ...EMPTY_MODEL, ...next[key], options: { ...next[key].options } },
			])
		),
		tools: { ...next.tools },
		mcpTools: structuredClone(next.mcpTools),
	} as AgentProfileStore;
	const existing = profileStore(profileId).store;
	const preserved = SHARED_PROFILE_IDS.has(profileId)
		? Object.fromEntries(
				Object.entries(existing).filter(([key]) =>
					!['providerId', 'modelId', 'modelOptions', 'schemaVersion', 'migrations'].includes(key)
				)
			)
		: {};
	profileStore(profileId).store = { ...preserved, ...profile };
}

for (const profileId of AGENT_TOOL_PROFILE_IDS) write(profileId, read(profileId));

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
