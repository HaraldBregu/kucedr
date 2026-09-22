import type { AgentToolModelKind } from '@shared/agent_types';
import type { AgentToolProfileId } from '@shared/agent_tools';

export function toolModelApi(kind: AgentToolModelKind, profileId: AgentToolProfileId = 'chat') {
	return {
		getProviderId: async (): Promise<string | undefined> =>
			(await window.agent.getToolModel(kind, profileId)).providerId || undefined,
		setProviderId: async (providerId: string): Promise<void> => {
			const current = await window.agent.getToolModel(kind, profileId);
			await window.agent.setToolModel(kind, { ...current, providerId }, profileId);
		},
		getModelId: async (): Promise<string | undefined> =>
			(await window.agent.getToolModel(kind, profileId)).modelId || undefined,
		setModelId: async (modelId: string): Promise<void> => {
			const current = await window.agent.getToolModel(kind, profileId);
			await window.agent.setToolModel(kind, { ...current, modelId }, profileId);
		},
		getOptions: async (): Promise<Record<string, unknown>> =>
			(await window.agent.getToolModel(kind, profileId)).options,
		setOptions: async (options: Record<string, unknown>): Promise<Record<string, unknown>> =>
			(
				await window.agent.setToolModel(kind, {
					...(await window.agent.getToolModel(kind, profileId)),
					options,
				}, profileId)
			).options,
	};
}
