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
	schemaVersion: number;
	migrations: string[];
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

const stores = Object.fromEntries(
	AGENT_TOOL_PROFILE_IDS.map((profileId) => [
		profileId,
		new Store<Partial<AgentProfileStore>>({
			name: `${profileId}-agent`,
			cwd: settingsDirectory,
			accessPropertiesByDotNotation: false,
		}),
	])
) as Record<AgentToolProfileId, Store<Partial<AgentProfileStore>>>;

function defaults(): AgentProfileStore {
	return {
		schemaVersion: 1,
		migrations: [],
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

function read(profileId: AgentToolProfileId): AgentProfileStore {
	const stored = stores[profileId].store;
	const fallback = defaults();
	return {
		...fallback,
		...stored,
		migrations: [...(stored.migrations ?? [])],
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
	stores[profileId].store = next;
}

export function initializeAgentProfile(
	profileId: AgentToolProfileId,
	patch: Partial<AgentProfileStore>,
	migration: string
): void {
	const current = read(profileId);
	if (current.migrations.includes(migration)) return;
	write(profileId, {
		...current,
		...patch,
		migrations: [...current.migrations, migration],
		tools: patch.tools ? { ...patch.tools } : current.tools,
		mcpTools: patch.mcpTools ? structuredClone(patch.mcpTools) : current.mcpTools,
	});
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
	return stores[profileId].path;
}
