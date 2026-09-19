import type { AgentToolModelKind } from '@shared/agent_types';

export function toolModelApi(kind: AgentToolModelKind) {
	return {
		getProviderId: async (): Promise<string | undefined> =>
			(await window.agent.getToolModel(kind)).providerId || undefined,
		setProviderId: async (providerId: string): Promise<void> => {
			const current = await window.agent.getToolModel(kind);
			await window.agent.setToolModel(kind, { ...current, providerId });
		},
		getModelId: async (): Promise<string | undefined> =>
			(await window.agent.getToolModel(kind)).modelId || undefined,
		setModelId: async (modelId: string): Promise<void> => {
			const current = await window.agent.getToolModel(kind);
			await window.agent.setToolModel(kind, { ...current, modelId });
		},
		getOptions: async (): Promise<Record<string, unknown>> =>
			(await window.agent.getToolModel(kind)).options,
		setOptions: async (options: Record<string, unknown>): Promise<Record<string, unknown>> =>
			(
				await window.agent.setToolModel(kind, {
					...(await window.agent.getToolModel(kind)),
					options,
				})
			).options,
	};
}

