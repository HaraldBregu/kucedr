import type {
	AgentChatbotModelKind,
	AgentToolModelKind,
	AgentVoiceModelKind,
} from '../../shared/agent_types';
import {
	getChatbotModel,
	getModelId as getAgentModelId,
	getProviderId as getAgentProviderId,
	getToolModel,
	getVoiceModel,
	setModelId as setAgentModelId,
	setProviderId as setAgentProviderId,
	setToolModel,
	setChatbotModel,
	setVoiceModel,
} from '../agent/agent_store';
import { getRagConfiguration, saveRagConfiguration } from '../agent/knowledge/rag/rag_store';

export type ModelKind =
	| 'text'
	| 'sound'
	| 'image'
	| 'video'
	| 'voice'
	| 'realtimeVoice'
	| 'transcribe'
	| 'realtime'
	| 'embedding';

export type MediaModelKind = 'image' | 'sound' | 'video' | 'voice' | 'realtimeVoice';

type ModelSelection = {
	providerId: string;
	modelId: string;
};

type SelectedModelKind = Exclude<ModelKind, 'text' | 'embedding'>;

const CHATBOT_MODEL_KINDS: Partial<Record<SelectedModelKind, AgentChatbotModelKind>> = {
	voice: 'textToSpeech',
	transcribe: 'speechToText',
	realtime: 'speechToText',
};

const VOICE_MODEL_KINDS: Partial<Record<SelectedModelKind, AgentVoiceModelKind>> = {
	realtimeVoice: 'realtimeVoice',
};

const TOOL_MODEL_KINDS: Partial<Record<SelectedModelKind, AgentToolModelKind>> = {
	sound: 'audio',
	image: 'image',
	video: 'video',
};

export function getProviderId(kind: ModelKind): string | undefined {
	return optionalTrimmedString(selection(kind).providerId);
}

export function setProviderId(kind: ModelKind, providerId: string): void {
	if (kind === 'text') {
		setAgentProviderId(providerId);
		return;
	}
	setSelection(kind, providerId, selection(kind).modelId);
}

export function getModelId(kind: ModelKind): string | undefined {
	return optionalTrimmedString(selection(kind).modelId);
}

export function setModelId(kind: ModelKind, modelId: string): void {
	if (kind === 'text') {
		setAgentModelId(modelId);
		return;
	}
	setSelection(kind, selection(kind).providerId, modelId);
}

export function setSelection(kind: ModelKind, providerId: string, modelId: string): void {
	if (kind === 'text') {
		setAgentProviderId(providerId);
		setAgentModelId(modelId);
		return;
	}
	if (kind === 'embedding') {
		saveRagConfiguration({
			...getRagConfiguration(),
			embeddingProviderId: providerId,
			embeddingModelId: modelId,
		});
		return;
	}
	const current = getStoredModel(kind);
	setStoredModel(kind, {
		providerId,
		modelId,
		options:
			current.providerId === providerId && current.modelId === modelId ? current.options : {},
	});
}

export function getOptions(kind: MediaModelKind): Record<string, unknown> {
	return getStoredModel(kind).options;
}

export function setOptions(kind: MediaModelKind, options: Record<string, unknown>): void {
	setStoredModel(kind, { ...getStoredModel(kind), options });
}

export function resolveOptions(
	kind: MediaModelKind,
	providerId: string,
	modelId: string,
	overrides?: Record<string, unknown>
): Record<string, unknown> | undefined {
	const configured = getStoredModel(kind);
	const defaults =
		configured.providerId === providerId && configured.modelId === modelId
			? configured.options
			: {};
	const resolved = { ...defaults, ...overrides };
	return Object.keys(resolved).length > 0 ? resolved : undefined;
}

function selection(kind: ModelKind): ModelSelection {
	if (kind === 'text') {
		return {
			providerId: getAgentProviderId() ?? '',
			modelId: getAgentModelId() ?? '',
		};
	}
	if (kind === 'embedding') {
		const configuration = getRagConfiguration();
		return {
			providerId: configuration.embeddingProviderId,
			modelId: configuration.embeddingModelId,
		};
	}
	const configured = getStoredModel(kind);
	return { providerId: configured.providerId, modelId: configured.modelId };
}

function getStoredModel(
	kind: SelectedModelKind
): import('../../shared/agent_types').AgentMediaModelSettings {
	const chatbotKind = CHATBOT_MODEL_KINDS[kind];
	if (chatbotKind) return getChatbotModel(chatbotKind);
	const voiceKind = VOICE_MODEL_KINDS[kind];
	if (voiceKind) return getVoiceModel(voiceKind);
	const toolKind = TOOL_MODEL_KINDS[kind];
	if (toolKind) return getToolModel(toolKind);
	throw new Error(`Unsupported model kind: ${kind}`);
}

function setStoredModel(
	kind: SelectedModelKind,
	settings: import('../../shared/agent_types').AgentMediaModelSettings
): void {
	const chatbotKind = CHATBOT_MODEL_KINDS[kind];
	if (chatbotKind) return setChatbotModel(chatbotKind, settings);
	const voiceKind = VOICE_MODEL_KINDS[kind];
	if (voiceKind) return setVoiceModel(voiceKind, settings);
	const toolKind = TOOL_MODEL_KINDS[kind];
	if (toolKind) return setToolModel(toolKind, settings);
	throw new Error(`Unsupported model kind: ${kind}`);
}

function optionalTrimmedString(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}
