import { normalizeProviderId } from '../../../shared/provider_types';
import { RealtimeVoiceChannels } from '../../../shared/ipc_channels_definitions';
import type { Agent } from '../agent';
import { builtinTools } from '../runner/run_builtin_tools';
import { createToolDiscovery } from '../runner/run_discovery';
import { filterDisabledTools } from '../runner/run_tools';
import { buildSystemPrompt, buildWorkspaceContext } from '../system';
import type { EventBus } from '../../event_bus';
import { defaultProviderId, loadModels } from '../../models';
import {
	buildRealtimeVoiceAdapter,
	realtimeVoiceDefaultVoice,
	supportsRealtimeVoiceModel,
	supportsRealtimeVoiceTools,
} from '../../models/adapters/realtime_voice';
import { getModelId, getOptions, getProviderId } from '../../models/selection';
import { getProvider } from '../../settings_store';
import { realtimeVoiceConversationFactory } from './conversation';
import { RealtimeVoiceManager } from './manager';
import { openAppWindows } from '../../apps/app_render';
import { getPermissions } from '../agent_store';

export function createRealtimeVoiceManager(
	agent: Agent,
	eventBus: EventBus
): RealtimeVoiceManager {
	const manager = new RealtimeVoiceManager({
		createAdapter: buildRealtimeVoiceAdapter,
		resources: agent.resources,
		memoryContext: (query) => agent.memory?.context(query) ?? Promise.resolve(''),
		createConversation: realtimeVoiceConversationFactory(
			agent.config,
			agent.sessions,
			agent.memory
		),
		emit: (windowId, event) => {
			eventBus.sendTo(windowId, RealtimeVoiceChannels.sessionEvent, event);
			for (const appWindow of openAppWindows.values()) {
				if (appWindow.window.id === windowId && !appWindow.contents?.isDestroyed()) {
					appWindow.contents?.send(RealtimeVoiceChannels.sessionEvent, event);
				}
			}
		},
		resolveConfiguration: async () => {
			const configuredProviderId = getProviderId('realtimeVoice');
			const providerId = normalizeProviderId(
				configuredProviderId ?? defaultProviderId('realtime-voice') ?? ''
			);
			const provider = getProvider(providerId);
			const apiKey = provider?.apiKey.trim() ?? '';
			if (!apiKey) {
				throw new Error(
					`${provider?.name || providerId || 'Provider'} API key is required for realtime voice.`
				);
			}

			const models = loadModels().filter(
				(model) =>
					model.provider.id === providerId &&
					model.type === 'realtime-voice' &&
					supportsRealtimeVoiceModel(providerId, model.id)
			);
			const configuredModelId = getModelId('realtimeVoice');
			const model = configuredModelId
				? models.find((candidate) => candidate.id === configuredModelId)
				: (models.find((candidate) => candidate.default) ?? models[0]);
			if (!model) throw new Error('Configured realtime voice model is not supported.');

			const configuredVoice = getOptions('realtimeVoice').voice;
			const metadataVoice = model.metadata?.inputs.voice?.default;
			const supportedVoices = (model.metadata?.inputs.voice?.enum ?? []).filter(
				(value): value is string => typeof value === 'string'
			);
			const voice =
				typeof configuredVoice === 'string' &&
				configuredVoice.trim() &&
				supportedVoices.includes(configuredVoice.trim())
					? configuredVoice.trim()
					: typeof metadataVoice === 'string' &&
						  metadataVoice.trim() &&
						  supportedVoices.includes(metadataVoice.trim())
						? metadataVoice.trim()
						: (realtimeVoiceDefaultVoice(providerId) ?? '');
			const supportsTools = supportsRealtimeVoiceTools(providerId, model.id);
			const discovery = supportsTools
				? createToolDiscovery({
						eligible: filterDisabledTools(
							builtinTools(agent.config, agent.sandbox, 'default'),
							getPermissions().tools
						),
						required: [],
					})
				: undefined;
			const refreshTools = async (): Promise<{
				tools: ReturnType<typeof builtinTools>;
				instructions: string;
			}> => {
				const tools = discovery?.active() ?? [];
				const baseInstructions = await buildSystemPrompt(agent.config, tools);
				return {
					tools,
					instructions: [baseInstructions, discovery?.prompt()].filter(Boolean).join('\n\n'),
				};
			};
			const toolConfiguration = await refreshTools();
			const workspaceContext = await buildWorkspaceContext(agent.config);
			return {
				provider: {
					id: providerId,
					name: provider?.name || model.provider.name,
					apiKey,
				},
				modelId: model.id,
				voice,
				instructions: toolConfiguration.instructions,
				context: workspaceContext ? [{ role: 'user', text: workspaceContext }] : [],
				tools: toolConfiguration.tools,
				...(discovery ? { refreshTools } : {}),
			};
		},
	});
	return manager;
}
